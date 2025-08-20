import { Logger } from '../utils/logger.js';
import { ApplicationError, ErrorCodes } from '../utils/error-boundary.js';
import { GoogleSearchTool } from './google-search.js';
import { WeatherTool } from './weather-tool.js';

/**
 * Manages the registration and execution of tools.
 * Tools are used to extend the functionality of the Gemini API, allowing it to interact with external services.
 */
export class ToolManager {
    /**
     * Creates a new ToolManager and registers default tools.
     */
    constructor() {
        this.tools = new Map();
        this.mcpManager = null;
        this.registerDefaultTools();
    }

    /**
     * Sets the MCP manager for integration with MCP services.
     * @param {MCPManager} mcpManager - The MCP manager instance.
     */
    setMCPManager(mcpManager) {
        this.mcpManager = mcpManager;
    }

    /**
     * Registers the default tools: GoogleSearchTool and WeatherTool.
     */
    registerDefaultTools() {
        this.registerTool('googleSearch', new GoogleSearchTool());
        this.registerTool('weather', new WeatherTool());
    }

    /**
     * Registers a new tool.
     *
     * @param {string} name - The name of the tool.
     * @param {Object} toolInstance - The tool instance. Must have a `getDeclaration` method.
     * @throws {ApplicationError} Throws an error if a tool with the same name is already registered.
     */
    registerTool(name, toolInstance) {
        if (this.tools.has(name)) {
            throw new ApplicationError(
                `Tool ${name} is already registered`,
                ErrorCodes.INVALID_STATE
            );
        }
        this.tools.set(name, toolInstance);
        Logger.info(`Tool ${name} registered successfully`);
    }

    /**
     * Returns the tool declarations for all registered tools.
     * These declarations are used by the Gemini API to understand what tools are available.
     *
     * @returns {Object[]} An array of tool declarations.
     */
    getToolDeclarations() {
        const allDeclarations = [];
        
        // Add default tool declarations
        this.tools.forEach((tool, name) => {
            if (tool.getDeclaration) {
                if (name === 'weather') {
                    allDeclarations.push({
                        functionDeclarations: tool.getDeclaration()
                    });
                } else {
                    allDeclarations.push({ [name]: tool.getDeclaration() });
                }
            }
        });

        // Add MCP service declarations if MCP manager is available
        if (this.mcpManager) {
            const enabledServices = this.mcpManager.getEnabledServices();
            enabledServices.forEach(service => {
                try {
                    // Parse the service code to extract declarations
                    const declarations = this.extractDeclarationsFromCode(service.code);
                    if (declarations && declarations.length > 0) {
                        allDeclarations.push({
                            functionDeclarations: declarations
                        });
                    }
                } catch (error) {
                    Logger.error(`Failed to extract declarations from MCP service ${service.name}`, error);
                }
            });
        }

        return allDeclarations;
    }

    /**
     * Extracts tool declarations from MCP service code.
     * @param {string} code - The MCP service code.
     * @returns {Array|null} Array of declarations or null if none found.
     */
    extractDeclarationsFromCode(code) {
        try {
            // Create a function to safely evaluate the code and extract declarations
            const func = new Function(
                'declarations',
                `"use strict";
                // Mock context for declaration extraction
                const context = {
                    tools: {
                        addDeclaration: (decl) => {
                            declarations.push(decl);
                        }
                    }
                };
                
                // Execute the code in a controlled environment
                (function() {
                    ${code}
                }).call(context);
                
                return declarations;`
            );
            
            // Execute the function with an empty declarations array
            const declarations = [];
            func(declarations);
            return declarations.length > 0 ? declarations : null;
        } catch (error) {
            Logger.error('Error extracting declarations from MCP code', error);
            return null;
        }
    }

    /**
     * Handles a tool call from the Gemini API.
     * Executes the specified tool with the given arguments.
     *
     * @param {Object} functionCall - The function call object from the Gemini API.
     * @param {string} functionCall.name - The name of the tool to execute.
     * @param {Object} functionCall.args - The arguments to pass to the tool.
     * @param {string} functionCall.id - The ID of the function call.
     * @returns {Promise<Object>} A promise that resolves with the tool's response.
     * @throws {ApplicationError} Throws an error if the tool is unknown or if the tool execution fails.
     */
    async handleToolCall(functionCall) {
        const { name, args, id } = functionCall;
        Logger.info(`Handling tool call: ${name}`, { args });

        // Check if it's a default tool
        let tool;
        if (name === 'get_weather_on_date') {
            tool = this.tools.get('weather');
        } else {
            tool = this.tools.get(name);
        }

        // If it's a default tool, execute it directly
        if (tool) {
            try {
                const result = await tool.execute(args);
                return {
                    functionResponses: [{
                        response: { output: result },
                        id
                    }]
                };
            } catch (error) {
                Logger.error(`Tool execution failed: ${name}`, error);
                return {
                    functionResponses: [{
                        response: { error: error.message },
                        id
                    }]
                };
            }
        }

        // If it's not a default tool and we have MCP manager, check MCP services
        if (this.mcpManager) {
            try {
                // Find the service that provides this function
                const enabledServices = this.mcpManager.getEnabledServices();
                for (const service of enabledServices) {
                    // Try to execute the function in this service
                    const result = await this.mcpManager.executeService(service.id, {
                        function: name,
                        args: args
                    });
                    
                    if (result !== undefined) {
                        return {
                            functionResponses: [{
                                response: { output: result },
                                id
                            }]
                        };
                    }
                }
            } catch (error) {
                Logger.error(`MCP service execution failed for function: ${name}`, error);
                return {
                    functionResponses: [{
                        response: { error: error.message },
                        id
                    }]
                };
            }
        }

        // If we reach here, the tool is unknown
        throw new ApplicationError(
            `Unknown tool: ${name}`,
            ErrorCodes.INVALID_PARAMETER
        );
    }
} 