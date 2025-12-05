let base64Image = null; // 存储图片数据

// 1. 处理图片上传
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // 原始 Base64 字符串 (包含 "data:image/jpeg;base64,...")
            const rawBase64 = e.target.result;
            
            // 显示预览图
            const img = document.getElementById('preview');
            img.src = rawBase64;
            img.style.display = 'block';
            document.getElementById('upload-placeholder').style.display = 'none';

            // ⚠️ 关键：Gemini API 不需要前缀，需要把 "data:image/xxx;base64," 砍掉
            base64Image = rawBase64.split(',')[1];
            
            // 获取 MIME 类型 (比如 image/jpeg 或 image/png)
            window.imageMimeType = file.type;
        };
        reader.readAsDataURL(file);
    }
}

// 2. 核心逻辑：调用 Gemini
async function startMagic() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const plot = document.getElementById('plotInput').value.trim();
    const resultArea = document.getElementById('resultArea');
    const loading = document.getElementById('loading');
    const generateBtn = document.getElementById('generateBtn');

    // 校验
    if (!apiKey) return alert("请先粘贴你的 Gemini API Key");
    if (!base64Image) return alert("请先上传一张孩子的画");

    // UI 状态切换
    generateBtn.disabled = true;
    generateBtn.innerText = "✨ 正在施法中...";
    loading.classList.remove('hidden');
    resultArea.classList.add('hidden');

    try {
        // 构造 Prompt (提示词)
        // 我们告诉 Gemini：看图 + 读情节 + 写童话
        const promptText = `
        你是一位富有想象力的儿童绘本作家。
        请看这张孩子的涂鸦。
        1. 识别画中的主角（是什么动物或人物？有什么特征？）。
        2. 结合用户提供的情节灵感：“${plot || '自由发挥'}”。
        3. 创作一个温馨、有趣、有教育意义的儿童短故事（300字左右）。
        4. 请给故事起个可爱的标题。
        5. 输出格式请使用 Markdown，适当使用emoji。
        `;

        // 构造 API 请求
        // 使用 gemini-1.5-flash 模型，速度快且免费额度高
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [
                    { text: promptText }, // 文字部分
                    { 
                        inline_data: { 
                            mime_type: window.imageMimeType || "image/jpeg", 
                            data: base64Image // 图片部分 (纯Base64)
                        } 
                    }
                ]
            }]
        };

        // 发送请求
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || "网络请求失败");
        }

        const data = await response.json();
        
        // 解析 Gemini 的返回结果
        const storyText = data.candidates[0].content.parts[0].text;

        // 渲染结果
        document.getElementById('finalStory').innerHTML = marked.parse(storyText);
        resultArea.classList.remove('hidden');

    } catch (error) {
        alert("出错了: " + error.message);
        console.error(error);
    } finally {
        loading.classList.add('hidden');
        generateBtn.disabled = false;
        generateBtn.innerText = "✨ 施展魔法生成故事";
    }
}