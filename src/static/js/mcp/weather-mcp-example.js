// 示例MCP服务：获取天气信息
// 注意：这只是一个示例，实际使用时需要替换为真实的天气API

// 添加工具声明
tools.addDeclaration({
    name: "get_weather",
    description: "获取指定城市的天气信息",
    parameters: {
        type: "object",
        properties: {
            city: {
                type: "string",
                description: "城市名称"
            }
        },
        required: ["city"]
    }
});

// 天气数据模拟
function getWeatherData(city) {
    // 模拟的天气数据
    const weatherData = {
        "北京": { temperature: "22°C", condition: "晴", humidity: "45%" },
        "上海": { temperature: "25°C", condition: "多云", humidity: "60%" },
        "广州": { temperature: "28°C", condition: "阵雨", humidity: "75%" },
        "深圳": { temperature: "27°C", condition: "雷阵雨", humidity: "80%" }
    };
    
    return weatherData[city] || { temperature: "N/A", condition: "未知", humidity: "N/A" };
}

// 导出函数实现
function get_weather(args) {
    return new Promise((resolve) => {
        const city = args.city;
        const weather = getWeatherData(city);
        const result = `城市: ${city}
温度: ${weather.temperature}
天气: ${weather.condition}
湿度: ${weather.humidity}`;
        resolve(result);
    });
}

// 根据调用的函数名执行相应的函数
if (context.function === "get_weather") {
    return get_weather(context.args);
}