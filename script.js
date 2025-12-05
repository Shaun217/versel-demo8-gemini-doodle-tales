let base64Image = null; // 存储图片数据

// 1. 处理图片上传
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const rawBase64 = e.target.result;
            
            // 显示预览图
            const img = document.getElementById('preview');
            img.src = rawBase64;
            img.style.display = 'block';
            document.getElementById('upload-placeholder').style.display = 'none';

            // ⚠️ Gemini API 需要纯 Base64，去掉前缀
            base64Image = rawBase64.split(',')[1];
            
            // 获取 MIME 类型
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

    if (!apiKey) return alert("请先粘贴你的 Gemini API Key");
    if (!base64Image) return alert("请先上传一张孩子的画");

    generateBtn.disabled = true;
    generateBtn.innerText = "✨ 正在施法中...";
    loading.classList.remove('hidden');
    resultArea.classList.add('hidden');

    try {
        const promptText = `
        你是一位富有想象力的儿童绘本作家。
        请看这张孩子的涂鸦。
        1. 识别画中的主角（是什么动物或人物？有什么特征？）。
        2. 结合用户提供的情节灵感：“${plot || '自由发挥'}”。
        3. 创作一个温馨、有趣、有教育意义的儿童短故事（300字左右）。
        4. 请给故事起个可爱的标题。
        5. 输出格式请使用 Markdown，适当使用emoji。
        `;

        // 🔥 关键修改：使用 'gemini-1.5-flash-latest' 以确保找到模型
        // 如果这个还不行，请尝试改为 'gemini-1.5-pro-latest' (注意 Pro 版限制稍微严一点，但更聪明)
        const modelName = "gemini-1.5-flash-latest"; 
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{
                parts: [
                    { text: promptText },
                    { 
                        inline_data: { 
                            mime_type: window.imageMimeType || "image/jpeg", 
                            data: base64Image 
                        } 
                    }
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
            // 打印详细错误到控制台，方便调试
            console.error("Gemini API Error:", errData);
            throw new Error(errData.error?.message || "网络请求失败");
        }

        const data = await response.json();
        
        // 解析 Gemini 的返回结果
        if (data.candidates && data.candidates.length > 0) {
            const storyText = data.candidates[0].content.parts[0].text;
            document.getElementById('finalStory').innerHTML = marked.parse(storyText);
            resultArea.classList.remove('hidden');
        } else {
            throw new Error("AI 没有返回内容，可能是图片太模糊或包含敏感内容被拦截。");
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