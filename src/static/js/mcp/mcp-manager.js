import { Logger } from '../utils/logger.js';
import { ApplicationError, ErrorCodes } from '../utils/error-boundary.js';

/**
 * @class MCPManager
 * @description Manages Model Context Protocol (MCP) services
 */
export class MCPManager {
    /**
     * @constructor
     */
    constructor() {
        this.services = new Map();
        this.loadServicesFromStorage();
    }

    /**
     * Loads saved MCP services from localStorage
     * @private
     */
    loadServicesFromStorage() {
        try {
            const savedServices = localStorage.getItem('mcp_services');
            if (savedServices) {
                const services = JSON.parse(savedServices);
                Object.entries(services).forEach(([id, service]) => {
                    this.services.set(id, {
                        ...service,
                        enabled: service.enabled || false,
                        // Don't load code from storage for security reasons
                        code: ''
                    });
                });
            }
        } catch (error) {
            Logger.error('Failed to load MCP services from storage', error);
        }
    }

    /**
     * Saves MCP services to localStorage
     * @private
     */
    saveServicesToStorage() {
        try {
            const services = {};
            this.services.forEach((service, id) => {
                services[id] = {
                    id: service.id,
                    name: service.name,
                    description: service.description,
                    enabled: service.enabled
                };
            });
            localStorage.setItem('mcp_services', JSON.stringify(services));
        } catch (error) {
            Logger.error('Failed to save MCP services to storage', error);
        }
    }

    /**
     * Adds a new MCP service
     * @param {string} name - Service name
     * @param {string} description - Service description
     * @param {string} code - Service code
     * @returns {string} Service ID
     */
    addService(name, description, code) {
        const id = this.generateId();
        this.services.set(id, {
            id,
            name,
            description,
            code,
            enabled: false
        });
        this.saveServicesToStorage();
        return id;
    }

    /**
     * Updates an existing MCP service
     * @param {string} id - Service ID
     * @param {string} name - Service name
     * @param {string} description - Service description
     * @param {string} code - Service code
     */
    updateService(id, name, description, code) {
        if (this.services.has(id)) {
            const service = this.services.get(id);
            service.name = name;
            service.description = description;
            // Only update code if provided
            if (code !== undefined) {
                service.code = code;
            }
            this.saveServicesToStorage();
        }
    }

    /**
     * Removes an MCP service
     * @param {string} id - Service ID
     */
    removeService(id) {
        this.services.delete(id);
        this.saveServicesToStorage();
    }

    /**
     * Enables an MCP service
     * @param {string} id - Service ID
     */
    enableService(id) {
        if (this.services.has(id)) {
            this.services.get(id).enabled = true;
            this.saveServicesToStorage();
        }
    }

    /**
     * Disables an MCP service
     * @param {string} id - Service ID
     */
    disableService(id) {
        if (this.services.has(id)) {
            this.services.get(id).enabled = false;
            this.saveServicesToStorage();
        }
    }

    /**
     * Gets all MCP services
     * @returns {Array} List of services
     */
    getServices() {
        return Array.from(this.services.values());
    }

    /**
     * Gets a specific MCP service
     * @param {string} id - Service ID
     * @returns {Object|null} Service object or null if not found
     */
    getService(id) {
        return this.services.get(id) || null;
    }

    /**
     * Gets enabled MCP services
     * @returns {Array} List of enabled services
     */
    getEnabledServices() {
        return Array.from(this.services.values()).filter(service => service.enabled);
    }

    /**
     * Generates a unique ID
     * @returns {string} Unique ID
     * @private
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Validates MCP service code
     * @param {string} code - Service code to validate
     * @returns {Object} Validation result
     */
    validateCode(code) {
        try {
            // Basic validation - check if it's valid JavaScript
            new Function(code);
            return { valid: true, error: null };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Executes an MCP service
     * @param {string} id - Service ID
     * @param {Object} context - Execution context
     * @returns {Promise<any>} Service result
     */
    async executeService(id, context) {
        const service = this.services.get(id);
        if (!service || !service.enabled) {
            throw new ApplicationError(
                `MCP service ${id} not found or not enabled`,
                ErrorCodes.INVALID_STATE
            );
        }

        try {
            // Create a sandboxed environment for execution
            const sandbox = {
                console,
                fetch,
                context,
                Promise
            };

            // Create a function in the sandbox
            const func = new Function(
                ...Object.keys(sandbox),
                `"use strict"; ${service.code}`
            );

            // Execute the function with sandbox context
            const result = await func(...Object.values(sandbox));
            return result;
        } catch (error) {
            Logger.error(`MCP service ${id} execution failed`, error);
            throw new ApplicationError(
                `MCP service execution failed: ${error.message}`,
                ErrorCodes.UNKNOWN_ERROR,
                { originalError: error }
            );
        }
    }
}