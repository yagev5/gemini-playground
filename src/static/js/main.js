document.addEventListener('DOMContentLoaded', () => {
    const stylesheet = document.getElementById('main-stylesheet');
    if (stylesheet) {
        const version = new Date().getTime();
        stylesheet.href = `css/style.css?v=${version}`;
    }
});

import { MultimodalLiveClient } from './core/websocket-client.js';
import { AudioStreamer } from './audio/audio-streamer.js';
import { AudioRecorder } from './audio/audio-recorder.js';
import { CONFIG } from './config/config.js';
import { Logger } from './utils/logger.js';
import { VideoManager } from './video/video-manager.js';
import { ScreenRecorder } from './video/screen-recorder.js';
import { languages } from './language-selector.js';
import { MCPManager } from './mcp/mcp-manager.js';

/**
 * @fileoverview Main entry point for the application.
 * Initializes and manages the UI, audio, video, and WebSocket interactions.
 */

// DOM Elements
const logsContainer = document.getElementById('logs-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');
const micIcon = document.getElementById('mic-icon');
const audioVisualizer = document.getElementById('audio-visualizer');
const connectButton = document.getElementById('connect-button');
const cameraButton = document.getElementById('camera-button');
const cameraIcon = document.getElementById('camera-icon');
const stopVideoButton = document.getElementById('stop-video');
const screenButton = document.getElementById('screen-button');
const screenIcon = document.getElementById('screen-icon');
const screenContainer = document.getElementById('screen-container');
const screenPreview = document.getElementById('screen-preview');
const inputAudioVisualizer = document.getElementById('input-audio-visualizer');
const apiKeyInput = document.getElementById('api-key');
const voiceSelect = document.getElementById('voice-select');
const languageSelect = document.getElementById('language-select');
const fpsInput = document.getElementById('fps-input');
const configToggle = document.getElementById('config-toggle');
const configContainer = document.getElementById('config-container');
const themeToggle = document.getElementById('theme-toggle');
const mcpConfigToggle = document.getElementById('mcp-config-toggle');
const systemInstructionInput = document.getElementById('system-instruction');
systemInstructionInput.value = CONFIG.SYSTEM_INSTRUCTION.TEXT;
const applyConfigButton = document.getElementById('apply-config');
const exportLogButton = document.getElementById('export-log');
const responseTypeSelect = document.getElementById('response-type-select');

// MCP Elements
const mcpConfigContainer = document.getElementById('mcp-config-container');
const mcpServicesList = document.getElementById('mcp-services-list');
const mcpServiceIdInput = document.getElementById('mcp-service-id');
const mcpServiceNameInput = document.getElementById('mcp-service-name');
const mcpServiceDescriptionInput = document.getElementById('mcp-service-description');
const mcpServiceCodeInput = document.getElementById('mcp-service-code');
const mcpCodeValidation = document.getElementById('mcp-code-validation');
const mcpSaveServiceButton = document.getElementById('mcp-save-service');
const mcpCancelEditButton = document.getElementById('mcp-cancel-edit');
const mcpApplyConfigButton = document.getElementById('apply-mcp-config');
const mcpFormTitle = document.getElementById('mcp-form-title');

// Load saved values from localStorage
const savedApiKey = localStorage.getItem('gemini_api_key');
const savedVoice = localStorage.getItem('gemini_voice');
const savedLanguage = localStorage.getItem('gemini_language');
const savedFPS = localStorage.getItem('video_fps');
const savedSystemInstruction = localStorage.getItem('system_instruction');

// Initialize MCP Manager
const mcpManager = new MCPManager();

if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
}
if (savedVoice) {
    voiceSelect.value = savedVoice;
}

languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang.code;
    option.textContent = lang.name;
    languageSelect.appendChild(option);
});

if (savedLanguage) {
    languageSelect.value = savedLanguage;
} else {
    // Set default to Mandarin Chinese (China) if no saved language
    languageSelect.value = 'cmn-CN';
}

if (savedFPS) {
    fpsInput.value = savedFPS;
}
if (savedSystemInstruction) {
    systemInstructionInput.value = savedSystemInstruction;
    CONFIG.SYSTEM_INSTRUCTION.TEXT = savedSystemInstruction;
}

// Handle configuration panel toggle
configToggle.addEventListener('click', () => {
    configContainer.classList.toggle('active');
    configToggle.classList.toggle('active');
});

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    themeToggle.textContent = document.body.classList.contains('dark-mode') ? 'dark_mode' : 'light_mode';
});

// MCP Functions
function renderMCPServices() {
    mcpServicesList.innerHTML = '';
    const services = mcpManager.getServices();
    
    if (services.length === 0) {
        mcpServicesList.innerHTML = '<div class="no-services">暂无MCP服务</div>';
        return;
    }
    
    services.forEach(service => {
        const serviceElement = document.createElement('div');
        serviceElement.className = 'mcp-service-item';
        serviceElement.innerHTML = `
            <div class="mcp-service-info">
                <div class="mcp-service-name">${service.name}</div>
                <div class="mcp-service-description">${service.description || '无描述'}</div>
            </div>
            <div class="mcp-service-actions">
                <button class="mcp-toggle-service" data-id="${service.id}" data-enabled="${service.enabled}">
                    ${service.enabled ? '禁用' : '启用'}
                </button>
                <button class="mcp-edit-service" data-id="${service.id}">编辑</button>
                <button class="mcp-delete-service" data-id="${service.id}">删除</button>
            </div>
        `;
        mcpServicesList.appendChild(serviceElement);
    });
    
    // Add event listeners to action buttons
    document.querySelectorAll('.mcp-toggle-service').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const enabled = e.target.dataset.enabled === 'true';
            if (enabled) {
                mcpManager.disableService(id);
                e.target.textContent = '启用';
                e.target.dataset.enabled = 'false';
            } else {
                mcpManager.enableService(id);
                e.target.textContent = '禁用';
                e.target.dataset.enabled = 'true';
            }
        });
    });
    
    document.querySelectorAll('.mcp-edit-service').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const service = mcpManager.getService(id);
            if (service) {
                mcpServiceIdInput.value = service.id;
                mcpServiceNameInput.value = service.name;
                mcpServiceDescriptionInput.value = service.description || '';
                // Only load code if it exists in the service object
                if (service.code) {
                    mcpServiceCodeInput.value = service.code;
                }
                mcpFormTitle.textContent = '编辑服务';
            }
        });
    });
    
    document.querySelectorAll('.mcp-delete-service').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            if (confirm('确定要删除此服务吗？')) {
                mcpManager.removeService(id);
                renderMCPServices();
            }
        });
    });
}

function resetMCPForm() {
    mcpServiceIdInput.value = '';
    mcpServiceNameInput.value = '';
    mcpServiceDescriptionInput.value = '';
    mcpServiceCodeInput.value = '';
    mcpFormTitle.textContent = '添加新服务';
    mcpCodeValidation.textContent = '';
    mcpCodeValidation.className = 'code-validation';
}

// Validate MCP code
mcpServiceCodeInput.addEventListener('input', () => {
    const code = mcpServiceCodeInput.value;
    if (code.trim() === '') {
        mcpCodeValidation.textContent = '';
        mcpCodeValidation.className = 'code-validation';
        return;
    }
    
    const result = mcpManager.validateCode(code);
    if (result.valid) {
        mcpCodeValidation.textContent = '代码有效';
        mcpCodeValidation.className = 'code-validation valid';
    } else {
        mcpCodeValidation.textContent = `代码无效: ${result.error}`;
        mcpCodeValidation.className = 'code-validation invalid';
    }
});

// Save or update MCP service
mcpSaveServiceButton.addEventListener('click', () => {
    const id = mcpServiceIdInput.value;
    const name = mcpServiceNameInput.value.trim();
    const description = mcpServiceDescriptionInput.value.trim();
    const code = mcpServiceCodeInput.value;
    
    if (!name) {
        alert('请输入服务名称');
        return;
    }
    
    if (!code) {
        alert('请输入服务代码');
        return;
    }
    
    // Validate code before saving
    const validationResult = mcpManager.validateCode(code);
    if (!validationResult.valid) {
        alert(`代码无效: ${validationResult.error}`);
        return;
    }
    
    if (id) {
        // Update existing service
        mcpManager.updateService(id, name, description, code);
    } else {
        // Add new service
        mcpManager.addService(name, description, code);
    }
    
    // Refresh services list and reset form
    renderMCPServices();
    resetMCPForm();
});

// Cancel editing
mcpCancelEditButton.addEventListener('click', () => {
    resetMCPForm();
});

mcpConfigToggle.addEventListener('click', () => {
    // Show MCP config panel
    mcpConfigContainer.classList.toggle('active');
    mcpConfigToggle.classList.toggle('active');
    // Refresh services list when opening
    if (mcpConfigContainer.classList.contains('active')) {
        renderMCPServices();
        resetMCPForm();
    }
});

applyConfigButton.addEventListener('click', () => {
    configContainer.classList.toggle('active');
    configToggle.classList.toggle('active');
});

mcpApplyConfigButton.addEventListener('click', () => {
    mcpConfigContainer.classList.toggle('active');
    mcpConfigToggle.classList.toggle('active');
});

exportLogButton.addEventListener('click', () => {
    Logger.export();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
            console.log('SW registered: ', registration);
        }).catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
        });
    });
}

// State variables
let isRecording = false;
let audioStreamer = null;
let audioCtx = null;
let isConnected = false;
let audioRecorder = null;
let isVideoActive = false;
let videoManager = null;
let isScreenSharing = false;
let screenRecorder = null;
let isUsingTool = false;

// Multimodal Client
const client = new MultimodalLiveClient();
client.setMCPManager(mcpManager);

/**
 * Logs a message to the UI.
 * @param {string} message - The message to log.
 * @param {string} [type='system'] - The type of the message (system, user, ai).
 */
function logMessage(message, type = 'system') {
    const allowedSystemMessages = [
        'WebSocket 连接已打开',
        '已连接到 Gemini 多模态实时 API',
        '已与服务器断开连接',
        '设置完成'
    ];

    if (type === 'system' && !allowedSystemMessages.includes(message)) {
        Logger.info(message);
        return;
    }

    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry', type);

    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    timestamp.textContent = new Date().toLocaleTimeString();
    logEntry.appendChild(timestamp);

    const emoji = document.createElement('span');
    emoji.classList.add('emoji');
    switch (type) {
        case 'system':
            emoji.textContent = '⚙️';
            break;
        case 'user':
            emoji.textContent = '😊';
            break;
        case 'ai':
            emoji.textContent = '🤖';
            break;
    }
    logEntry.appendChild(emoji);

    const messageText = document.createElement('span');
    messageText.textContent = message;
    logEntry.appendChild(messageText);

    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

/**
 * Updates the microphone icon based on the recording state.
 */
function updateMicIcon() {
    micIcon.textContent = isRecording ? 'mic_off' : 'mic';
    micButton.style.backgroundColor = isRecording ? '#ea4335' : '#4285f4';
}

/**
 * Updates the audio visualizer based on the audio volume.
 * @param {number} volume - The audio volume (0.0 to 1.0).
 * @param {boolean} [isInput=false] - Whether the visualizer is for input audio.
 */
function updateAudioVisualizer(volume, isInput = false) {
    const visualizer = isInput ? inputAudioVisualizer : audioVisualizer;
    const audioBar = visualizer.querySelector('.audio-bar') || document.createElement('div');
    
    if (!visualizer.contains(audioBar)) {
        audioBar.classList.add('audio-bar');
        visualizer.appendChild(audioBar);
    }
    
    audioBar.style.width = `${volume * 100}%`;
    if (volume > 0) {
        audioBar.classList.add('active');
    } else {
        audioBar.classList.remove('active');
    }
}

/**
 * Initializes the audio context and streamer if not already initialized.
 * @returns {Promise<AudioStreamer>} The audio streamer instance.
 */
async function ensureAudioInitialized() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (!audioStreamer) {
        audioStreamer = new AudioStreamer(audioCtx);
        await audioStreamer.addWorklet('vumeter-out', 'js/audio/worklets/vol-meter.js', (ev) => {
            updateAudioVisualizer(ev.data.volume);
        });
    }
    return audioStreamer;
}

/**
 * Handles the microphone toggle. Starts or stops audio recording.
 * @returns {Promise<void>}
 */
async function handleMicToggle() {
    if (!isRecording) {
        try {
            await ensureAudioInitialized();
            audioRecorder = new AudioRecorder();
            
            const inputAnalyser = audioCtx.createAnalyser();
            inputAnalyser.fftSize = 256;
            const inputDataArray = new Uint8Array(inputAnalyser.frequencyBinCount);
            
            await audioRecorder.start((base64Data) => {
                if (isUsingTool) {
                    client.sendRealtimeInput([{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Data,
                        interrupt: true     // Model isn't interruptable when using tools, so we do it manually
                    }]);
                } else {
                    client.sendRealtimeInput([{
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Data
                    }]);
                }
                
                inputAnalyser.getByteFrequencyData(inputDataArray);
                const inputVolume = Math.max(...inputDataArray) / 255;
                updateAudioVisualizer(inputVolume, true);
            });

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(inputAnalyser);
            
            await audioStreamer.resume();
            isRecording = true;
            Logger.info('麦克风已启动');
            logMessage('麦克风已启动', 'system');
            updateMicIcon();
        } catch (error) {
            Logger.error('麦克风错误:', error);
            logMessage(`错误: ${error.message}`, 'system');
            isRecording = false;
            updateMicIcon();
        }
    } else {
        if (audioRecorder && isRecording) {
            audioRecorder.stop();
        }
        isRecording = false;
        logMessage('麦克风已停止', 'system');
        updateMicIcon();
        updateAudioVisualizer(0, true);
    }
}

/**
 * Resumes the audio context if it's suspended.
 * @returns {Promise<void>}
 */
async function resumeAudioContext() {
    if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

/**
 * Connects to the WebSocket server.
 * @returns {Promise<void>}
 */
async function connectToWebsocket() {
    if (!apiKeyInput.value) {
        logMessage('请输入 API 密钥', 'system');
        return;
    }

    // Save values to localStorage
    localStorage.setItem('gemini_api_key', apiKeyInput.value);
    localStorage.setItem('gemini_voice', voiceSelect.value);
    localStorage.setItem('gemini_language', languageSelect.value);
    localStorage.setItem('system_instruction', systemInstructionInput.value);

    const config = {
        model: CONFIG.API.MODEL_NAME,
        generationConfig: {
            responseModalities: responseTypeSelect.value,
            speechConfig: {
                languageCode: languageSelect.value,
                voiceConfig: { 
                    prebuiltVoiceConfig: { 
                        voiceName: voiceSelect.value    // You can change voice in the config.js file
                    }
                }
            },
        },
        systemInstruction: {
            parts: [{
                text: systemInstructionInput.value     // You can change system instruction in the config.js file
            }],
        }
    };  

    try {
        await client.connect(config,apiKeyInput.value);
        isConnected = true;
        await resumeAudioContext();
        updateConnectButtonText();
        connectButton.classList.add('connected');
        messageInput.disabled = false;
        sendButton.disabled = false;
        micButton.disabled = false;
        cameraButton.disabled = false;
        screenButton.disabled = false;
        logMessage('已连接到 Gemini 多模态实时 API', 'system');
    } catch (error) {
        const errorMessage = error.message || '未知错误';
        Logger.error('连接错误:', error);
        logMessage(`连接错误: ${errorMessage}`, 'system');
        isConnected = false;
        updateConnectButtonText();
        connectButton.classList.remove('connected');
        messageInput.disabled = true;
        sendButton.disabled = true;
        micButton.disabled = true;
        cameraButton.disabled = true;
        screenButton.disabled = true;
    }
}

/**
 * Disconnects from the WebSocket server.
 */
function disconnectFromWebsocket() {
    client.disconnect();
    isConnected = false;
    if (audioStreamer) {
        audioStreamer.stop();
        if (audioRecorder) {
            audioRecorder.stop();
            audioRecorder = null;
        }
        isRecording = false;
        updateMicIcon();
    }
    updateConnectButtonText();
    connectButton.classList.remove('connected');
    messageInput.disabled = true;
    sendButton.disabled = true;
    micButton.disabled = true;
    cameraButton.disabled = true;
    screenButton.disabled = true;
    logMessage('已与服务器断开连接', 'system');
    
    if (videoManager) {
        stopVideo();
    }
    
    if (screenRecorder) {
        stopScreenSharing();
    }
}

/**
 * Handles sending a text message.
 */
function handleSendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        logMessage(message, 'user');
        client.send({ text: message });
        messageInput.value = '';
    }
}

// Event Listeners
client.on('open', () => {
    logMessage('WebSocket 连接已打开', 'system');
});

client.on('log', (log) => {
    logMessage(`${log.type}: ${JSON.stringify(log.message)}`, 'system');
});

client.on('close', (event) => {
    logMessage(`WebSocket 连接已关闭 (代码 ${event.code})`, 'system');
});

client.on('audio', async (data) => {
    try {
        // 确保 AudioContext 在接收到音频数据时被激活
        await resumeAudioContext(); 
        const streamer = await ensureAudioInitialized();
        streamer.addPCM16(new Uint8Array(data));
    } catch (error) {
        logMessage(`处理音频时出错: ${error.message}`, 'system');
    }
});

client.on('content', (data) => {
    if (data.modelTurn) {
        if (data.modelTurn.parts.some(part => part.functionCall)) {
            isUsingTool = true;
            Logger.info('Model is using a tool');
        } else if (data.modelTurn.parts.some(part => part.functionResponse)) {
            isUsingTool = false;
            Logger.info('Tool usage completed');
        }

        const text = data.modelTurn.parts.map(part => part.text).join('');
        if (text) {
            logMessage(text, 'ai');
        }
    }
});

client.on('interrupted', () => {
    audioStreamer?.stop();
    isUsingTool = false;
    Logger.info('模型已中断');
    logMessage('模型已中断', 'system');
});

client.on('setupcomplete', () => {
    logMessage('设置完成', 'system');
});

client.on('turncomplete', () => {
    isUsingTool = false;
    logMessage('回合完成', 'system');
});

client.on('error', (error) => {
    if (error instanceof ApplicationError) {
        Logger.error(`Application error: ${error.message}`, error);
    } else {
        Logger.error('意外错误', error);
    }
    logMessage(`错误: ${error.message}`, 'system');
});

client.on('message', (message) => {
    if (message.error) {
        Logger.error('服务器错误:', message.error);
        logMessage(`服务器错误: ${message.error}`, 'system');
    }
});

sendButton.addEventListener('click', handleSendMessage);
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        handleSendMessage();
    }
});

micButton.addEventListener('click', handleMicToggle);

connectButton.addEventListener('click', () => {
    if (isConnected) {
        disconnectFromWebsocket();
    } else {
        connectToWebsocket();
    }
});

// Function to update connect button text based on screen size
function updateConnectButtonText() {
    if (isConnected) {
        // On mobile devices, use shorter text
        if (window.innerWidth <= 768) {
            connectButton.textContent = '断开';
        } else {
            connectButton.textContent = '断开连接';
        }
    } else {
        connectButton.textContent = '连接';
    }
}

// Update button text on window resize
window.addEventListener('resize', updateConnectButtonText);

// Initial update
updateConnectButtonText();

messageInput.disabled = true;
sendButton.disabled = true;
micButton.disabled = true;
connectButton.textContent = '连接';

/**
 * Handles the video toggle. Starts or stops video streaming.
 * @returns {Promise<void>}
 */
async function handleVideoToggle() {
    Logger.info('Video toggle clicked, current state:', { isVideoActive, isConnected });
    
    localStorage.setItem('video_fps', fpsInput.value);

    if (!isVideoActive) {
        try {
            Logger.info('Attempting to start video');
            if (!videoManager) {
                videoManager = new VideoManager();
            }
            
            await videoManager.start(fpsInput.value,(frameData) => {
                if (isConnected) {
                    client.sendRealtimeInput([frameData]);
                }
            });

            isVideoActive = true;
            cameraIcon.textContent = 'videocam_off';
            cameraButton.classList.add('active');
            Logger.info('摄像头已成功启动');
            logMessage('摄像头已启动', 'system');

        } catch (error) {
            Logger.error('摄像头错误:', error);
            logMessage(`错误: ${error.message}`, 'system');
            isVideoActive = false;
            videoManager = null;
            cameraIcon.textContent = 'videocam';
            cameraButton.classList.remove('active');
        }
    } else {
        Logger.info('Stopping video');
        stopVideo();
    }
}

/**
 * Stops the video streaming.
 */
function stopVideo() {
    if (videoManager) {
        videoManager.stop();
        videoManager = null;
    }
    isVideoActive = false;
    cameraIcon.textContent = 'videocam';
    cameraButton.classList.remove('active');
    logMessage('摄像头已停止', 'system');
}

cameraButton.addEventListener('click', handleVideoToggle);
stopVideoButton.addEventListener('click', stopVideo);

cameraButton.disabled = true;

/**
 * Handles the screen share toggle. Starts or stops screen sharing.
 * @returns {Promise<void>}
 */
async function handleScreenShare() {
    if (!isScreenSharing) {
        try {
            screenContainer.style.display = 'block';
            
            screenRecorder = new ScreenRecorder();
            await screenRecorder.start(screenPreview, (frameData) => {
                if (isConnected) {
                    client.sendRealtimeInput([{
                        mimeType: "image/jpeg",
                        data: frameData
                    }]);
                }
            });

            isScreenSharing = true;
            screenIcon.textContent = 'stop_screen_share';
            screenButton.classList.add('active');
            Logger.info('屏幕共享已启动');
            logMessage('屏幕共享已启动', 'system');

        } catch (error) {
            Logger.error('屏幕共享错误:', error);
            logMessage(`错误: ${error.message}`, 'system');
            isScreenSharing = false;
            screenIcon.textContent = 'screen_share';
            screenButton.classList.remove('active');
            screenContainer.style.display = 'none';
        }
    } else {
        stopScreenSharing();
    }
}

/**
 * Stops the screen sharing.
 */
function stopScreenSharing() {
    if (screenRecorder) {
        screenRecorder.stop();
        screenRecorder = null;
    }
    isScreenSharing = false;
    screenIcon.textContent = 'screen_share';
    screenButton.classList.remove('active');
    screenContainer.style.display = 'none';
    logMessage('屏幕共享已停止', 'system');
}

screenButton.addEventListener('click', handleScreenShare);
screenButton.disabled = true;
