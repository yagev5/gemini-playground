// MCP服务示例代码
// 这是一个简单的示例，展示如何编写MCP服务

// 添加工具声明
tools.addDeclaration({
    name: "get_current_time",
    description: "获取当前时间",
    parameters: {
        type: "object",
        properties: {},
        required: []
    }
});

// 导出函数实现
function get_current_time() {
    return new Promise((resolve) => {
        const now = new Date();
        const timeString = now.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        resolve(timeString);
    });
}

// 根据调用的函数名执行相应的函数
if (context.function === "get_current_time") {
    return get_current_time(context.args);
}