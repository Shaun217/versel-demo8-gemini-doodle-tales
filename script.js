let base64Image = null;
let imageMimeType = null;

// 1. 处理图片上传
function handleFile(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const raw = e.target.result;
            // 预览
            document.getElementById('previewImg').src = raw;
            document.getElementById('previewImg').classList.remove('hidden');
            document.getElementById('uploadPlaceholder').classList.add('hidden');
            
            // 准备发给 API 的数据
            base64Image = raw.split(',')[1];
            imageMimeType = file.type;
        };
        reader.readAsDataURL(file);
    }
}

// 2. 自动获取 Gemini 模型 (防报错)
async function getModelName(apiKey) {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await res.json();
        // 优先找 flash 模型，便宜又快
        const model = data.models?.find(m => m.name.includes('flash')) || 
                      data.models?.find(m => m.name.includes('pro'));
        return model ? model.name.replace('models/', '') : 'gemini-1.5-flash';
    } catch {
        return 'gemini-1.5-flash';
    }
}

// 3. 核心生成逻辑
async function generateArt() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const userPrompt = document.getElementById('promptInput').value.trim();
    
    if (!apiKey) return alert("请先输入 API Key");
    if (!base64Image) return alert("请先上传图片");

    // UI 状态
    const btn = document.getElementById('magicBtn');
    const resultBox = document.getElementById('resultSection');
    const loading = document.getElementById('loading');
    const loadingText = document.getElementById('loadingText');
    const finalImg = document.getElementById('finalImage');
    const promptText = document.getElementById('generatedPrompt');

    btn.disabled = true;
    resultBox.classList.remove('hidden');
    loading.classList.remove('hidden');
    finalImg.classList.add('hidden'); // 先隐藏旧图

    try {
        // --- STEP 1: 让 Gemini 描述图片并生成绘画咒语 ---
        loadingText.innerText = "👀 Gemini 正在观察涂鸦...";
        const modelName = await getModelName(apiKey);
        
        // 这是一个精心设计的 Prompt，让 Gemini 提取特征
        const systemPrompt = `
        你是一个 AI 绘画提示词专家。
        任务：观察这张用户上传的涂鸦，结合用户的描述，写一个用于 AI 绘画的英文 Prompt。
        
        用户的描述：${userPrompt || "A cute character"}
        
        要求：
        1. 仔细描述涂鸦中角色的视觉特征（颜色、动物种类、身体形状），一定要保留这些特征。
        2. 将画风设定为：3D cute cartoon style, Pixar style, high quality, vibrant colors, soft lighting.
        3. 结合用户的描述加入动作和背景。
        4. 只输出这一段英文 Prompt，不要包含其他文字。
        `;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        { inline_data: { mime_type: imageMimeType, data: base64Image } }
                    ]
                }]
            })
        });

        const data = await res.json();
        if (!data.candidates) throw new Error("Gemini 没有返回内容");
        
        // 获取到的英文咒语
        const magicPrompt = data.candidates[0].content.parts[0].text.trim();
        promptText.innerText = magicPrompt;

        // --- STEP 2: 调用 Pollinations 生成图片 ---
        loadingText.innerText = "🎨 正在绘制卡通画...";
        
        // 构造图片 URL (使用 encodeURIComponent 处理特殊字符)
        // seed 参数加个随机数，保证每次不一样
        const randomSeed = Math.floor(Math.random() * 10000);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(magicPrompt)}?width=1024&height=1024&seed=${randomSeed}&model=flux`;

        // 预加载图片，加载完再显示
        const imgObj = new Image();
        imgObj.src = imageUrl;
        imgObj.onload = () => {
            finalImg.src = imageUrl;
            finalImg.classList.remove('hidden');
            loading.classList.add('hidden');
            btn.disabled = false;
        };

    } catch (error) {
        alert("出错了: " + error.message);
        btn.disabled = false;
        loading.classList.add('hidden');
    }
}

function downloadImage() {
    const img = document.getElementById('finalImage');
    if (img.src) {
        const link = document.createElement('a');
        link.href = img.src;
        link.download = 'magic_doodle.jpg';
        link.click();
    }
}