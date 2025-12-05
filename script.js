let base64Image = null;

// 1. 图片处理
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const rawBase64 = e.target.result;
            const img = document.getElementById('preview');
            img.src = rawBase64;
            img.style.display = 'block';
            document.getElementById('upload-placeholder').style.display = 'none';
            
            // 去掉 Base64 前缀
            base64Image = rawBase64.split(',')[1];
            window.imageMimeType = file.type;
        };
        reader.readAsDataURL(file);
    }
}

// 2. ✨ 新增：自动获取可用模型 ✨
async function getValidModel(apiKey) {
    try {
        // 请求模型列表
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        
        if (!data.models) throw new Error("无法获取模型列表");

        // 策略：优先找 'gemini-1.5-flash'，找不到就找 'gemini-1.5-pro'
        const models = data.models.map(m => m.name.replace('models/', ''));
        
        // 优先匹配 flash
        let bestModel = models.find(m => m.includes('gemini-1.5-flash'));
        // 其次匹配 pro
        if (!bestModel) bestModel = models.find(m => m.includes('gemini-1.5-pro'));
        // 还没找到？随便拿个 gemini
        if (!bestModel) bestModel = models.find(m => m.includes('gemini'));

        console.log("自动选择的最佳模型:", bestModel);
        return bestModel || "gemini-1.5-flash"; // 实在不行用默认的

    } catch (e) {
        console.warn("自动获取模型失败，使用默认值:", e);
        return "gemini-1.5-flash"; // 降级方案
    }
}

// 3. 核心逻辑
async function startMagic() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const plot = document.getElementById('plotInput').value.trim();
    const resultArea = document.getElementById('resultArea');
    const loading = document.getElementById('loading');
    const generateBtn = document.getElementById('generateBtn');

    if (!apiKey) return alert("请先输入 API Key");
    if (!base64Image) return alert("请先上传图片");

    generateBtn.disabled = true;
    generateBtn.innerText = "🔍 正在寻找最佳 AI 模型...";
    loading.classList.remove('hidden');
    resultArea.classList.add('hidden');

    try {
        // 第一步：自动确定模型名称
        const modelName = await getValidModel(apiKey);
        generateBtn.innerText = `✨ 正使用 ${modelName} 施法中...`;

        // 第二步：构造请求
        const promptText = `
        你是一位儿童绘本作家。请看这张涂鸦。
        1. 识别主角特征。
        2. 结合情节：“${plot || '自由发挥'}”。
        3. 写一个300字的温馨童话。
        4. 使用Markdown格式。
        `;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [
                    { text: promptText },
                    { inline_data: { mime_type: window.imageMimeType || "image/jpeg", data: base64Image } }
                ]
            }]
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || "请求被拒绝");
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates.length > 0) {
            const storyText = data.candidates[0].content.parts[0].text;
            document.getElementById('finalStory').innerHTML = marked.parse(storyText);
            resultArea.classList.remove('hidden');
        } else {
            throw new Error("AI 生成了空内容，请重试");
        }

    } catch (error) {
        alert("出错了: " + error.message);
        console.error(error);
    } finally {
        loading.classList.add('hidden');
        generateBtn.disabled = false;
        generateBtn.innerText = "✨ 施展魔法生成故事";
    }
}