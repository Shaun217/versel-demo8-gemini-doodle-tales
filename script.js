let base64Image = null;
let imageMimeType = null;

// UI 交互：切换设置菜单
function toggleSettings() {
    document.querySelector('.settings-box').classList.toggle('closed');
}

// 1. 处理图片上传
function handleFile(event) {
    const file = event.target.files[0];
    if (file) {
        // 简单的体积校验 (超过 4MB 提醒)
        if (file.size > 4 * 1024 * 1024) {
           alert("图片有点大，处理可能会变慢哦，建议压缩一下~");
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const raw = e.target.result;
            // 显示原图预览
            document.getElementById('originalPreview').src = raw;
            document.getElementById('originalPreview').classList.remove('hidden');
            document.getElementById('uploadPlaceholder').classList.add('hidden');
            
            // 准备 API 数据
            base64Image = raw.split(',')[1];
            imageMimeType = file.type;
        };
        reader.readAsDataURL(file);
    }
}

// 自动适配 Gemini 模型
async function getModelName(apiKey) {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await res.json();
        // 优先用 flash 模型，速度快
        const model = data.models?.find(m => m.name.includes('flash')) || 
                      data.models?.find(m => m.name.includes('pro'));
        return model ? model.name.replace('models/', '') : 'gemini-1.5-flash';
    } catch {
        return 'gemini-1.5-flash';
    }
}

// 2. 核心流程：开始变身
async function startConversion() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const selectedStyle = document.getElementById('styleSelect').value;
    
    if (!apiKey) {
        toggleSettings(); // 打开设置提示用户
        return alert("请先点击上方设置，填入你的 Gemini API Key");
    }
    if (!base64Image) return alert("请先拍照或上传图片");

    // UI 状态更新
    const genBtn = document.getElementById('generateBtn');
    const dlBtn = document.getElementById('downloadBtn');
    const loadingState = document.getElementById('loadingState');
    const loadingText = document.getElementById('loadingText');
    const resultImg = document.getElementById('cartoonResult');
    const resultPlaceholder = document.getElementById('resultPlaceholder');

    genBtn.disabled = true;
    dlBtn.classList.add('hidden');
    resultImg.classList.add('hidden');
    resultPlaceholder.classList.add('hidden');
    loadingState.classList.remove('hidden');

    try {
        // --- PHASE 1: Gemini 显微镜观察 (关键!) ---
        loadingText.innerText = "🔍 AI 正在用显微镜分析照片细节...";
        const modelName = await getModelName(apiKey);
        
        // 🔥 核心 Prompt：强制 Gemini 极其详细地描述细节，不要发挥想象 🔥
        const systemPrompt = `
        Task: You are a forensic image analyst. Describe the provided image in extreme detail for the purpose of recreating it accurately in a different art style.
        
        Directives:
        1.  **Object fidelity is paramount.** Describe exactly what objects are present, their specific colors, materials, textures, brand logos (if text is clear), and relative positions.
        2.  **Describe the environment.** Lighting (soft, harsh, sunny), background elements, time of day.
        3.  **Do NOT be creative.** Do not invent things not in the photo. Just describe what is there factually and brutally.
        4.  **Final output format:** Create a single, detailed English paragraph describing the scene. End the paragraph with this exact style modifier string: ", in ${selectedStyle}."
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
        if (!data.candidates) throw new Error("Gemini 无法识别图片内容，请换张图重试。");
        
        // 获取到超详细的描述 Prompt
        const detailedPrompt = data.candidates[0].content.parts[0].text.trim();
        console.log("Gemini 生成的详细描述:", detailedPrompt);

        // --- PHASE 2: Pollinations 绘画 ---
        loadingText.innerText = "🎨 正在绘制卡通版本 (约 10 秒)...";
        
        // 使用随机种子防止缓存，尝试使用 flux 模型提升质量
        const randomSeed = Math.floor(Math.random() * 99999);
        // URL 编码 Prompt
        const encodedPrompt = encodeURIComponent(detailedPrompt);
        // 构造请求地址，强制正方形，使用 flux 模型
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${randomSeed}&model=flux&nolog=true`;

        // 预加载图片
        const tempImg = new Image();
        tempImg.src = imageUrl;
        
        // 设置超时机制 (Pollinations 有时会卡住)
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("绘图超时，请重试")), 30000)
        );

        await Promise.race([
            new Promise(resolve => tempImg.onload = resolve),
            timeout
        ]);

        // 加载成功，显示结果
        resultImg.src = imageUrl;
        resultImg.classList.remove('hidden');
        loadingState.classList.add('hidden');
        dlBtn.classList.remove('hidden');
        genBtn.disabled = false;

    } catch (error) {
        console.error(error);
        alert("出错了: " + error.message);
        genBtn.disabled = false;
        loadingState.classList.add('hidden');
        resultPlaceholder.classList.remove('hidden');
    }
}

// 下载功能
function downloadImage() {
    const img = document.getElementById('cartoonResult');
    if (img.src) {
        // 创建一个临时的阿标签触发下载
        const link = document.createElement('a');
        // 由于跨域图片直接下载可能会变成打开新标签，这里尝试用 fetch 转 blob 下载
        fetch(img.src)
            .then(res => res.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                link.href = url;
                link.download = 'cartoon_me_result.jpg';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            })
            .catch(() => {
                // 降级方案：直接在新窗口打开
                window.open(img.src, '_blank');
            });
    }
}