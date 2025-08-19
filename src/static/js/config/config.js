export const CONFIG = {
    API: {
        VERSION: 'v1beta',
        MODEL_NAME: 'models/gemini-live-2.5-flash-preview'
    },
    // You can change the system instruction to your liking
    SYSTEM_INSTRUCTION: {
        TEXT: '你是一个乐于助人的助手。你可以听懂我说的话，并用语音和文本回应。如果你不知道某个问题的答案，可以使用谷歌搜索工具来查找答案',
    },
    // Default audio settings
    AUDIO: {
        SAMPLE_RATE: 16000,
        OUTPUT_SAMPLE_RATE: 24000,      // If you want to have fun, set this to around 14000 (u certainly will)
        BUFFER_SIZE: 2048,
        CHANNELS: 1
    },
    // If you are working in the RoArm branch 
    // ROARM: {
    //     IP_ADDRESS: '192.168.1.4'
    // }
  };
  
  export default CONFIG;
