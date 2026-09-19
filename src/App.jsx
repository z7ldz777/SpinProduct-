import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Constants ──────────────────────────────────────────────────────
const PALETTE = [
  { name: 'Snow', value: '#FFFFFF' },
  { name: 'Pearl', value: '#F5F0EB' },
  { name: 'Blush', value: '#FFD6E0' },
  { name: 'Lavender', value: '#C8B6FF' },
  { name: 'Sky', value: '#A2D2FF' },
  { name: 'Mint', value: '#B8F3D0' },
  { name: 'Butter', value: '#FFF3B0' },
  { name: 'Peach', value: '#FFCBA4' },
  { name: 'Coral', value: '#FF8A80' },
  { name: 'Slate', value: '#64748B' },
  { name: 'Charcoal', value: '#334155' },
  { name: 'Midnight', value: '#0F172A' },
]

const SPEEDS = { slow: 4000, medium: 2000, fast: 1000 }
const TOTAL_FRAMES = 60

const EXPORT_RESOLUTIONS = [
  { label: 'Instagram Post', short: '1080x1080', w: 1080, h: 1080 },
  { label: 'Instagram Story', short: '1080x1920', w: 1080, h: 1920 },
  { label: 'Square', short: '720x720', w: 720, h: 720 },
]

const PROGRESS_MESSAGES = [
  'Sending to AI...',
  'Generating your spin video...',
  'AI is working its magic...',
  'Almost there...',
  'Finalizing...',
]

function colorName(hex) {
  const p = PALETTE.find(c => c.value.toLowerCase() === hex.toLowerCase())
  return p ? p.name.toLowerCase() : hex
}

// ─── Draw a single spin frame onto a canvas context ─────────────────
function drawSpinFrame(ctx, frameIndex, frontImg, backImg, bgColor, canvasW, canvasH) {
  const cx = canvasW / 2
  const imgAreaH = canvasH * 0.72
  const imgAreaW = canvasW * 0.6
  const imgY = canvasH * 0.08

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, canvasW, canvasH)

  const f = frameIndex % TOTAL_FRAMES
  const angle = (f / TOTAL_FRAMES) * 360
  const rad = (angle * Math.PI) / 180

  let img, scaleX, perspectiveSkew
  if (f < 15) {
    img = frontImg
    const t = f / 14
    scaleX = Math.cos(t * Math.PI / 2)
    perspectiveSkew = t * 0.08
  } else if (f === 15) {
    img = null; scaleX = 0; perspectiveSkew = 0
  } else if (f < 30) {
    img = backImg
    const t = (f - 16) / 13
    scaleX = Math.sin(t * Math.PI / 2)
    perspectiveSkew = (1 - t) * 0.08
  } else if (f < 45) {
    img = backImg
    const t = (f - 30) / 14
    scaleX = Math.cos(t * Math.PI / 2)
    perspectiveSkew = t * 0.08
  } else if (f === 45) {
    img = null; scaleX = 0; perspectiveSkew = 0
  } else {
    img = frontImg
    const t = (f - 46) / 13
    scaleX = Math.sin(t * Math.PI / 2)
    perspectiveSkew = (1 - t) * 0.08
  }

  // Shadow
  const shadowW = (Math.abs(scaleX) * 0.4 + 0.15) * canvasW
  const shadowH = canvasH * 0.03
  const shadowY = imgY + imgAreaH + canvasH * 0.02
  const shadowShift = Math.sin(rad) * canvasW * 0.04
  ctx.save()
  ctx.translate(cx + shadowShift, shadowY)
  ctx.scale(1, 0.3)
  ctx.beginPath()
  ctx.ellipse(0, 0, shadowW / 2, shadowH * 2, 0, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(0,0,0,${0.12 * Math.abs(scaleX) + 0.04})`
  ctx.fill()
  ctx.restore()

  if (!img) {
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(cx - 1, imgY, 2, imgAreaH)
    ctx.restore()
    return
  }

  const drawW = imgAreaW * Math.abs(scaleX)
  if (drawW < 1) return

  const farShrink = perspectiveSkew * imgAreaH
  const nearSide = (angle > 0 && angle < 180) ? 'right' : 'left'

  ctx.save()
  ctx.translate(cx - drawW / 2, imgY)

  const slices = Math.max(Math.floor(drawW), 1)
  for (let s = 0; s < slices; s++) {
    const t = slices === 1 ? 0.5 : s / (slices - 1)
    const sliceH = nearSide === 'right'
      ? imgAreaH - farShrink * (1 - t)
      : imgAreaH - farShrink * t
    const sliceY = (imgAreaH - sliceH) / 2
    const srcX = (s / slices) * img.naturalWidth
    const srcW = Math.max(img.naturalWidth / slices, 1)
    ctx.drawImage(img, srcX, 0, srcW, img.naturalHeight, s, sliceY, Math.ceil(drawW / slices) + 1, sliceH)
  }

  const lightGrad = ctx.createLinearGradient(0, 0, drawW, 0)
  if (nearSide === 'right') {
    lightGrad.addColorStop(0, 'rgba(0,0,0,0.15)')
    lightGrad.addColorStop(0.5, 'rgba(0,0,0,0)')
    lightGrad.addColorStop(1, 'rgba(255,255,255,0.05)')
  } else {
    lightGrad.addColorStop(0, 'rgba(255,255,255,0.05)')
    lightGrad.addColorStop(0.5, 'rgba(0,0,0,0)')
    lightGrad.addColorStop(1, 'rgba(0,0,0,0.15)')
  }
  ctx.fillStyle = lightGrad
  ctx.fillRect(0, 0, drawW, imgAreaH)
  ctx.restore()
}

function prerenderFrames(frontImg, backImg, bgColor, w, h) {
  const frames = []
  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    drawSpinFrame(c.getContext('2d'), i, frontImg, backImg, bgColor, w, h)
    frames.push(c)
  }
  return frames
}

// ─── Toast Component ────────────────────────────────────────────────
function Toast({ message, visible, onHide }) {
  useEffect(() => {
    if (visible) { const t = setTimeout(onHide, 3000); return () => clearTimeout(t) }
  }, [visible, onHide])
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-500
      ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
      <div className="px-5 py-3 rounded-2xl bg-gray-900 text-white text-sm font-medium shadow-2xl border border-white/10 backdrop-blur-sm">
        {message}
      </div>
    </div>
  )
}

// ─── Upload Box Component ───────────────────────────────────────────
function UploadBox({ label, image, onUpload, darkMode, hint }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) onUpload(file)
  }, [onUpload])
  const handleChange = useCallback((e) => { const file = e.target.files[0]; if (file) onUpload(file) }, [onUpload])
  const borderIdle = darkMode
    ? 'border-white/20 hover:border-violet-400/60 bg-white/5 hover:bg-white/[0.08]'
    : 'border-gray-300 hover:border-violet-400/60 bg-gray-50 hover:bg-gray-100'
  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-[200px] max-w-[320px]">
      <div
        className={`relative group w-full aspect-[3/4] rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
          ${dragging ? 'border-violet-400 bg-violet-500/10 scale-[1.02]' : image ? 'border-transparent' : borderIdle}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {!image && (
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3), rgba(59,130,246,0.3))', backgroundSize: '200% 200%', animation: 'gradient-shift 3s ease infinite' }} />
        )}
        {image ? (
          <div className="relative w-full h-full">
            <img src={image} alt={label} className="w-full h-full object-cover rounded-2xl" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 rounded-2xl flex items-center justify-center">
              <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm font-medium">Change {label}</span>
            </div>
            <span className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs text-white font-medium">{label}</span>
          </div>
        ) : (
          <div className="relative z-10 flex flex-col items-center justify-center h-full gap-3 px-4">
            <div className={`w-12 h-12 rounded-xl ${darkMode ? 'bg-white/10' : 'bg-gray-200'} flex items-center justify-center group-hover:bg-violet-500/20 transition-colors duration-300`}>
              <svg className={`w-6 h-6 ${darkMode ? 'text-white/50' : 'text-gray-400'} group-hover:text-violet-300 transition-colors duration-300`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div className="text-center">
              <p className={`${darkMode ? 'text-white/70' : 'text-gray-600'} text-sm font-medium`}>{label}</p>
              <p className={`${darkMode ? 'text-white/30' : 'text-gray-400'} text-xs mt-1`}>Drag & drop or click</p>
            </div>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </div>
      {hint && <p className={`text-[10px] ${darkMode ? 'text-white/30' : 'text-gray-400'} text-center`}>{hint}</p>}
    </div>
  )
}

// ─── Main App ───────────────────────────────────────────────────────
export default function App() {
  const [frontImage, setFrontImage] = useState(null)
  const [backImage, setBackImage] = useState(null)
  const [frontImg, setFrontImg] = useState(null)
  const [backImg, setBackImg] = useState(null)
  const [bgColor, setBgColor] = useState('#0F172A')
  const [customColor, setCustomColor] = useState('#8B5CF6')
  const [speed, setSpeed] = useState('medium')
  const [direction, setDirection] = useState('right')
  const [playing, setPlaying] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  const [recording, setRecording] = useState(false)
  const [generatingGif, setGeneratingGif] = useState(false)
  const [processingFrames, setProcessingFrames] = useState(false)
  const [exportRes, setExportRes] = useState(0)
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)

  // AI state
  const [aiOpen, setAiOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [howToOpen, setHowToOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState('')
  const [genPercent, setGenPercent] = useState(0)
  const [genError, setGenError] = useState('')
  const [videoUrl, setVideoUrl] = useState(null)
  const [videoBlob, setVideoBlob] = useState(null)
  const [videoPlaying, setVideoPlaying] = useState(true)
  const [showAiVideo, setShowAiVideo] = useState(false)

  // Canvas / animation refs
  const previewCanvasRef = useRef(null)
  const framesRef = useRef([])
  const frameIndexRef = useRef(0)
  const lastTimeRef = useRef(null)
  const animFrameRef = useRef(null)
  const accRef = useRef(0)

  // Recording refs
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  // AI refs
  const videoRef = useRef(null)
  const genStartRef = useRef(0)
  const progressIntervalRef = useRef(null)

  const showToast = useCallback((msg) => { setToastMsg(msg); setToastVisible(true) }, [])

  const hasImages = frontImage || backImage

  // ─── Load image element ───────────────────────────────────────────
  const loadImageElement = useCallback((dataUrl) => {
    return new Promise((resolve) => {
      if (!dataUrl) { resolve(null); return }
      const img = new Image()
      img.onload = () => resolve(img)
      img.src = dataUrl
    })
  }, [])

  const handleUpload = useCallback((setter, imgSetter) => (file) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target.result
      setter(dataUrl)
      const img = await loadImageElement(dataUrl)
      imgSetter(img)
    }
    reader.readAsDataURL(file)
  }, [loadImageElement])

  // ─── Pre-render frames ────────────────────────────────────────────
  useEffect(() => {
    if (!frontImg && !backImg) { framesRef.current = []; return }
    setProcessingFrames(true)
    const timer = setTimeout(() => {
      framesRef.current = prerenderFrames(frontImg || backImg, backImg || frontImg, bgColor, 560, 560)
      setProcessingFrames(false)
      setPlaying(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [frontImg, backImg, bgColor])

  // ─── Animation loop ───────────────────────────────────────────────
  useEffect(() => {
    const canvas = previewCanvasRef.current
    if (!canvas) return
    if (!playing || framesRef.current.length === 0) {
      lastTimeRef.current = null
      if (framesRef.current.length > 0) {
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(framesRef.current[frameIndexRef.current % TOTAL_FRAMES], 0, 0, canvas.width, canvas.height)
      }
      return
    }
    const duration = SPEEDS[speed]
    const frameDuration = duration / TOTAL_FRAMES
    const dir = direction === 'right' ? 1 : -1

    const animate = (time) => {
      if (lastTimeRef.current === null) { lastTimeRef.current = time; accRef.current = 0 }
      const delta = time - lastTimeRef.current
      lastTimeRef.current = time
      accRef.current += delta
      while (accRef.current >= frameDuration) {
        accRef.current -= frameDuration
        frameIndexRef.current = ((frameIndexRef.current + dir) % TOTAL_FRAMES + TOTAL_FRAMES) % TOTAL_FRAMES
      }
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(framesRef.current[frameIndexRef.current], 0, 0, canvas.width, canvas.height)
      animFrameRef.current = requestAnimationFrame(animate)
    }
    animFrameRef.current = requestAnimationFrame(animate)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [playing, speed, direction])

  // ─── Reset ────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setFrontImage(null); setBackImage(null); setFrontImg(null); setBackImg(null)
    setBgColor('#0F172A'); setSpeed('medium'); setDirection('right'); setPlaying(true)
    setRecording(false); setVideoUrl(null); setVideoBlob(null); setShowAiVideo(false)
    setGenError(''); setGenerating(false); setGenProgress(''); setGenPercent(0)
    framesRef.current = []; frameIndexRef.current = 0
    const canvas = previewCanvasRef.current
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
  }, [])

  // ─── Recording (one full rotation, auto-stop) ────────────────────
  const startRecording = useCallback(() => {
    if (framesRef.current.length === 0) return
    const res = EXPORT_RESOLUTIONS[exportRes]
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = res.w; exportCanvas.height = res.h
    const useFront = frontImg || backImg, useBack = backImg || frontImg
    const exportFrames = prerenderFrames(useFront, useBack, bgColor, res.w, res.h)

    setRecording(true); chunksRef.current = []
    const stream = exportCanvas.captureStream(30)
    let mimeType = 'video/webm;codecs=vp9'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `spinshot-${res.short}.webm`; a.click()
      URL.revokeObjectURL(url); setRecording(false); showToast('Video saved! \uD83C\uDF89')
    }
    recorder.start()

    const dir = direction === 'right' ? 1 : -1
    const frameDuration = SPEEDS[speed] / TOTAL_FRAMES
    let localFrame = frameIndexRef.current, localCount = 0, lastT = null, localAcc = 0
    const drawExport = (time) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return
      if (lastT === null) lastT = time
      localAcc += time - lastT; lastT = time
      while (localAcc >= frameDuration) {
        localAcc -= frameDuration
        localFrame = ((localFrame + dir) % TOTAL_FRAMES + TOTAL_FRAMES) % TOTAL_FRAMES
        localCount++
      }
      const ctx = exportCanvas.getContext('2d')
      ctx.clearRect(0, 0, res.w, res.h)
      ctx.drawImage(exportFrames[localFrame], 0, 0, res.w, res.h)
      if (localCount >= TOTAL_FRAMES) {
        setTimeout(() => { if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop() }, 100)
        return
      }
      requestAnimationFrame(drawExport)
    }
    requestAnimationFrame(drawExport)
  }, [exportRes, frontImg, backImg, bgColor, speed, direction, showToast])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
  }, [])

  // ─── GIF Export ───────────────────────────────────────────────────
  const downloadGif = useCallback(async () => {
    if (!hasImages) return
    setGeneratingGif(true)
    await new Promise(r => setTimeout(r, 50))
    const res = EXPORT_RESOLUTIONS[exportRes]
    const w = Math.min(res.w, 720), h = Math.min(res.h, 720)
    const gifFrames = prerenderFrames(frontImg || backImg, backImg || frontImg, bgColor, w, h)
    const frameDelay = Math.round(SPEEDS[speed] / TOTAL_FRAMES)
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    const frameData = []
    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const idx = direction === 'right' ? i : (TOTAL_FRAMES - i) % TOTAL_FRAMES
      ctx.clearRect(0, 0, w, h); ctx.drawImage(gifFrames[idx], 0, 0, w, h)
      frameData.push({ data: ctx.getImageData(0, 0, w, h), delay: frameDelay })
    }
    const gif = encodeGif(w, h, frameData)
    const blob = new Blob([gif], { type: 'image/gif' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `spinshot-${w}x${h}.gif`; a.click()
    URL.revokeObjectURL(url); setGeneratingGif(false); showToast('GIF saved! \uD83C\uDF89')
  }, [hasImages, frontImg, backImg, bgColor, speed, direction, exportRes, showToast])

  // ─── Gemini Veo AI Generation ─────────────────────────────────────
  const dataUrlToBase64 = useCallback((dataUrl) => dataUrl.split(',')[1], [])

  const startProgressTicker = useCallback(() => {
    genStartRef.current = Date.now(); setGenPercent(0); setGenProgress(PROGRESS_MESSAGES[0])
    let msgIdx = 0
    progressIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - genStartRef.current) / 1000
      setGenPercent(Math.min(95, Math.round((elapsed / 90) * 100)))
      const newIdx = Math.min(Math.floor(elapsed / 15), PROGRESS_MESSAGES.length - 1)
      if (newIdx !== msgIdx) { msgIdx = newIdx; setGenProgress(PROGRESS_MESSAGES[msgIdx]) }
    }, 500)
  }, [])

  const stopProgressTicker = useCallback(() => {
    if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null }
  }, [])

  const extractVideoFromResponse = useCallback(async (data) => {
    let videoData = null, mimeType = 'video/mp4'
    if (data.candidates) {
      for (const cand of data.candidates) {
        for (const part of (cand?.content?.parts || [])) {
          if (part?.inlineData?.data) { videoData = part.inlineData.data; mimeType = part.inlineData.mimeType || mimeType; break }
          if (part?.fileData?.fileUri) { setVideoUrl(part.fileData.fileUri); setShowAiVideo(true); showToast('AI spin video generated!'); return }
        }
        if (videoData) break
      }
    }
    if (!videoData && data.generatedVideos) {
      const vid = data.generatedVideos[0]
      if (vid?.video?.uri) { setVideoUrl(vid.video.uri); setShowAiVideo(true); showToast('AI spin video generated!'); return }
      if (vid?.video?.bytesBase64Encoded) videoData = vid.video.bytesBase64Encoded
    }
    if (!videoData && data.predictions) {
      const pred = data.predictions[0]
      if (typeof pred === 'string') videoData = pred
      else if (pred?.bytesBase64Encoded) videoData = pred.bytesBase64Encoded
      else if (pred?.uri) { setVideoUrl(pred.uri); setShowAiVideo(true); showToast('AI spin video generated!'); return }
    }
    if (!videoData) {
      const json = JSON.stringify(data)
      const urlMatch = json.match(/https?:\/\/[^\s"]+\.mp4[^\s"]*/i)
      if (urlMatch) { setVideoUrl(urlMatch[0]); setShowAiVideo(true); showToast('AI spin video generated!'); return }
      throw new Error('No video returned. Veo may require a paid API key (billing enabled in Google Cloud).')
    }
    const binary = atob(videoData)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: mimeType })
    setVideoBlob(blob); setVideoUrl(URL.createObjectURL(blob)); setShowAiVideo(true)
    showToast('AI spin video generated!')
  }, [showToast])

  const pollOperation = useCallback(async (key, operationName) => {
    while (true) {
      await new Promise(r => setTimeout(r, 5000))
      const res = await fetch(`/api/gemini/v1beta/${operationName}?key=${key}`)
      if (!res.ok) throw new Error(`Polling error: ${res.status}`)
      const data = await res.json()
      if (data.done) {
        if (data.error) throw new Error(data.error.message || 'Video generation failed.')
        await extractVideoFromResponse(data.response || data); return
      }
    }
  }, [extractVideoFromResponse])

  const generateAiVideo = useCallback(async () => {
    if (!frontImage || !apiKey.trim()) return
    setGenerating(true); setGenError(''); setVideoUrl(null); setVideoBlob(null)
    startProgressTicker()
    const key = apiKey.trim()
    const bgName = colorName(bgColor)
    let prompt = `Product showcase video: Slowly rotate this clothing item 360 degrees. The item should spin smoothly in place against a solid ${bgName} (${bgColor}) colored background. Professional product photography style, clean studio lighting, smooth continuous rotation. The garment should be displayed as if on an invisible mannequin rotating slowly.`
    if (backImage) prompt += ' The back of the garment is also provided for reference.'

    const imageParts = [{ inlineData: { mimeType: 'image/jpeg', data: dataUrlToBase64(frontImage) } }]
    if (backImage) imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: dataUrlToBase64(backImage) } })

    try {
      let res = await fetch(`/api/gemini/v1beta/models/veo-3.1-generate-preview:generateVideos?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
          generationConfig: { responseModality: 'video', numberOfVideos: 1 },
        }),
      })

      if (res.status === 404) {
        res = await fetch(`/api/gemini/v1beta/models/veo-3.1-generate-preview:predictLongRunning?key=${key}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt, image: { bytesBase64Encoded: dataUrlToBase64(frontImage), mimeType: 'image/jpeg' } }],
            parameters: { sampleCount: 1 },
          }),
        })
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const errMsg = errBody?.error?.message || ''
        if (res.status === 401 || res.status === 403) throw new Error('Invalid API key.')
        if (res.status === 429) throw new Error('Rate limit exceeded. Veo requires billing enabled on your Google Cloud project. The free tier has very limited or no Veo quota.')
        throw new Error(errMsg || `API error: ${res.status}`)
      }

      const data = await res.json()
      if (data.name) { await pollOperation(key, data.name); return }
      await extractVideoFromResponse(data)
    } catch (err) {
      if (err.name === 'AbortError') return
      setGenError(err.message || 'Something went wrong.')
    } finally {
      setGenerating(false); stopProgressTicker(); setGenPercent(100)
    }
  }, [frontImage, backImage, apiKey, bgColor, dataUrlToBase64, startProgressTicker, stopProgressTicker, pollOperation, extractVideoFromResponse])

  const downloadAiVideo = useCallback(async () => {
    if (!videoUrl) return
    try {
      let blob = videoBlob
      if (!blob) { const res = await fetch(videoUrl); blob = await res.blob() }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `spinshot-ai.${(blob.type || 'video/mp4').includes('mp4') ? 'mp4' : 'webm'}`
      a.click(); URL.revokeObjectURL(url); showToast('Video downloaded!')
    } catch { showToast('Download failed.') }
  }, [videoUrl, videoBlob, showToast])

  const toggleVideoPlayback = useCallback(() => {
    const vid = videoRef.current; if (!vid) return
    if (vid.paused) { vid.play(); setVideoPlaying(true) } else { vid.pause(); setVideoPlaying(false) }
  }, [])

  // ─── Theme helpers ────────────────────────────────────────────────
  const theme = darkMode ? 'bg-[#0a0a0f] text-white' : 'bg-[#f8f9fa] text-gray-900'
  const cardBg = darkMode ? 'bg-white/[0.04]' : 'bg-white'
  const cardBorder = darkMode ? 'border-white/10' : 'border-gray-200'
  const subtleText = darkMode ? 'text-white/50' : 'text-gray-400'
  const mutedText = darkMode ? 'text-white/70' : 'text-gray-600'

  return (
    <div className={`min-h-screen ${theme} transition-colors duration-500 relative overflow-x-hidden`}>
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: `radial-gradient(circle at 1px 1px, ${darkMode ? 'white' : 'black'} 1px, transparent 0)`, backgroundSize: '32px 32px' }} />
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.07] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #8B5CF6, transparent 70%)' }} />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.05] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #EC4899, transparent 70%)' }} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-12">
        {/* ─── Header ──────────────────────────────────────────── */}
        <header className="pt-8 pb-10 sm:pt-12 sm:pb-14 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Spin<span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">Shot</span>
            </h1>
          </div>
          <p className={`text-base sm:text-lg ${mutedText} max-w-lg mx-auto leading-relaxed`}>
            Turn 2 photos into a stunning product spin
          </p>
          <div className="absolute top-6 right-4 sm:right-6 flex items-center gap-2">
            {hasImages && (
              <button onClick={handleReset} className={`p-2.5 rounded-xl ${cardBg} border ${cardBorder} hover:scale-105 active:scale-95 transition-all duration-200`} title="Reset">
                <svg className={`w-4 h-4 ${darkMode ? 'text-white/60' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2.5 rounded-xl ${cardBg} border ${cardBorder} hover:scale-105 active:scale-95 transition-all duration-200`}>
              {darkMode ? (
                <svg className="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
              ) : (
                <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
              )}
            </button>
          </div>
        </header>

        {/* ─── Upload Section ──────────────────────────────────── */}
        <section className="mb-8">
          <div className="flex flex-col sm:flex-row items-start justify-center gap-4 sm:gap-6">
            <UploadBox label="Front" image={frontImage} onUpload={handleUpload(setFrontImage, setFrontImg)} darkMode={darkMode} />
            <div className={`hidden sm:flex flex-col items-center gap-2 pt-20 ${subtleText}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <UploadBox label="Back" image={backImage} onUpload={handleUpload(setBackImage, setBackImg)} darkMode={darkMode} />
          </div>
        </section>

        {/* ─── Customization Bar ───────────────────────────────── */}
        <section className={`mb-8 rounded-2xl ${cardBg} border ${cardBorder} p-4 sm:p-5 backdrop-blur-sm`}>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            {/* Background Colors */}
            <div className="flex flex-col items-center gap-2.5">
              <span className={`text-xs font-medium uppercase tracking-wider ${subtleText}`}>Background</span>
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {PALETTE.map((c) => (
                  <button key={c.value} onClick={() => setBgColor(c.value)}
                    className={`w-7 h-7 rounded-full transition-all duration-200 hover:scale-110 active:scale-95
                      ${bgColor === c.value ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-transparent scale-110' : ''}
                      ${c.value === '#FFFFFF' ? 'border border-gray-300' : ''}`}
                    style={{ backgroundColor: c.value }} title={c.name} />
                ))}
                <div className="relative">
                  <button onClick={() => setBgColor(customColor)}
                    className={`w-7 h-7 rounded-full transition-all duration-200 hover:scale-110 overflow-hidden
                      ${!PALETTE.find(c => c.value === bgColor) ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-transparent scale-110' : ''}`}
                    style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} title="Custom" />
                  <input type="color" value={customColor} onChange={(e) => { setCustomColor(e.target.value); setBgColor(e.target.value) }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-7 h-7" />
                </div>
              </div>
            </div>

            <div className={`hidden sm:block w-px h-10 ${darkMode ? 'bg-white/10' : 'bg-gray-200'}`} />

            {/* Speed */}
            <div className="flex flex-col items-center gap-2.5">
              <span className={`text-xs font-medium uppercase tracking-wider ${subtleText}`}>Speed</span>
              <div className={`flex rounded-xl overflow-hidden border ${cardBorder}`}>
                {Object.keys(SPEEDS).map((s) => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={`px-3.5 py-1.5 text-xs font-medium capitalize transition-all duration-200
                      ${speed === s ? 'bg-violet-500 text-white' : `${darkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'}`}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className={`hidden sm:block w-px h-10 ${darkMode ? 'bg-white/10' : 'bg-gray-200'}`} />

            {/* Direction */}
            <div className="flex flex-col items-center gap-2.5">
              <span className={`text-xs font-medium uppercase tracking-wider ${subtleText}`}>Direction</span>
              <div className={`flex rounded-xl overflow-hidden border ${cardBorder}`}>
                <button onClick={() => setDirection('left')}
                  className={`px-3.5 py-1.5 text-xs font-medium transition-all duration-200 flex items-center gap-1.5
                    ${direction === 'left' ? 'bg-violet-500 text-white' : `${darkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'}`}`}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Left
                </button>
                <button onClick={() => setDirection('right')}
                  className={`px-3.5 py-1.5 text-xs font-medium transition-all duration-200 flex items-center gap-1.5
                    ${direction === 'right' ? 'bg-violet-500 text-white' : `${darkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'}`}`}>
                  Right
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </div>
            </div>

            <div className={`hidden sm:block w-px h-10 ${darkMode ? 'bg-white/10' : 'bg-gray-200'}`} />

            {/* Play/Pause */}
            <div className="flex flex-col items-center gap-2.5">
              <span className={`text-xs font-medium uppercase tracking-wider ${subtleText}`}>Playback</span>
              <button onClick={() => setPlaying(!playing)}
                className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 border ${cardBorder}
                  ${playing ? `${darkMode ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}` : 'bg-violet-500 text-white hover:bg-violet-600'}`}>
                {playing ? '\u23F8 Pause' : '\u25B6 Play'}
              </button>
            </div>
          </div>
        </section>

        {/* ─── Preview Section ─────────────────────────────────── */}
        <section className="mb-8">
          <div className="relative mx-auto rounded-3xl overflow-hidden shadow-2xl transition-all duration-500"
            style={{ backgroundColor: bgColor, width: '100%', maxWidth: '560px', aspectRatio: '1' }}>
            <div className="absolute inset-0 rounded-3xl pointer-events-none" style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.08)' }} />

            {/* AI Video mode */}
            {showAiVideo && videoUrl ? (
              <div className="absolute inset-0">
                <video ref={videoRef} src={videoUrl} autoPlay loop muted playsInline className="w-full h-full object-contain rounded-3xl" />
                <button onClick={toggleVideoPlayback} className="absolute inset-0 flex items-center justify-center group/play">
                  <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/play:opacity-100 transition-opacity duration-200">
                    {videoPlaying ? (
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                    ) : (
                      <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    )}
                  </div>
                </button>
                {/* Switch back to canvas */}
                <button onClick={() => setShowAiVideo(false)}
                  className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium hover:bg-black/70 transition-colors">
                  Show Canvas Spin
                </button>
              </div>
            ) : hasImages ? (
              <>
                {processingFrames && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-sm rounded-3xl">
                    <svg className="w-8 h-8 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-white/70 text-sm font-medium">Processing frames...</span>
                  </div>
                )}
                <canvas ref={previewCanvasRef} width={560} height={560} className="absolute inset-0 w-full h-full rounded-3xl" />
                {/* Switch to AI video if available */}
                {videoUrl && (
                  <button onClick={() => setShowAiVideo(true)}
                    className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-violet-500/80 backdrop-blur-sm text-white text-[10px] font-medium hover:bg-violet-500 transition-colors z-10">
                    Show AI Video
                  </button>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className={`w-20 h-20 rounded-2xl ${darkMode ? 'bg-white/10' : 'bg-black/5'} flex items-center justify-center`}>
                  <svg className={`w-10 h-10 ${darkMode ? 'text-white/20' : 'text-black/15'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className={`text-sm ${darkMode ? 'text-white/30' : 'text-black/25'}`}>Upload images to see the preview</p>
              </div>
            )}
          </div>
        </section>

        {/* ─── Export Section ───────────────────────────────────── */}
        {hasImages && (
          <section className="mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className={`text-xs font-medium uppercase tracking-wider ${subtleText}`}>Export size</span>
              <div className={`flex rounded-xl overflow-hidden border ${cardBorder}`}>
                {EXPORT_RESOLUTIONS.map((r, i) => (
                  <button key={r.short} onClick={() => setExportRes(i)}
                    className={`px-3 py-1.5 text-[11px] font-medium transition-all duration-200
                      ${exportRes === i ? 'bg-violet-500 text-white' : `${darkMode ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'}`}`}>
                    {r.short}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={recording ? stopRecording : startRecording} disabled={processingFrames}
                className={`group px-6 py-3 rounded-2xl font-medium text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2.5 min-w-[180px] justify-center
                  ${recording ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25' : 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40'}`}>
                {recording ? (<><span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />Recording...</>) : (
                  <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" /></svg>Record Video</>
                )}
              </button>
              <button onClick={downloadGif} disabled={generatingGif || processingFrames}
                className={`px-6 py-3 rounded-2xl font-medium text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2.5 min-w-[180px] justify-center border ${cardBorder} ${cardBg}
                  ${darkMode ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}>
                {generatingGif ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Generating...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Download GIF</>
                )}
              </button>
            </div>
            {recording && <p className={`text-center text-xs ${subtleText} mt-3`}>Recording one full rotation — will auto-stop when complete</p>}
          </section>
        )}

        {/* ─── AI Enhancement (collapsible upgrade) ────────────── */}
        <section className={`mb-10 rounded-2xl ${cardBg} border ${cardBorder} backdrop-blur-sm overflow-hidden`}>
          <button onClick={() => setAiOpen(!aiOpen)}
            className={`w-full flex items-center justify-between p-4 sm:p-5 hover:bg-white/[0.02] transition-colors`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>AI Video Enhancement</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${darkMode ? 'bg-violet-500/20 text-violet-300' : 'bg-violet-100 text-violet-600'}`}>Upgrade</span>
                </div>
                <p className={`text-xs ${subtleText} mt-0.5`}>Generate a realistic AI spin video with Google Veo (requires billing)</p>
              </div>
            </div>
            <svg className={`w-4 h-4 ${subtleText} transition-transform duration-200 ${aiOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {aiOpen && (
            <div className={`px-4 sm:px-5 pb-5 border-t ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
              <div className="max-w-lg mx-auto pt-4">
                {/* API Key */}
                <div className="flex items-center gap-2 mb-2">
                  <svg className={`w-3.5 h-3.5 ${darkMode ? 'text-violet-400' : 'text-violet-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className={`text-xs font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Google AI API Key</span>
                  {apiKey && <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">Connected</span>}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex-1">
                    <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste your API key..."
                      className={`w-full pl-3 pr-10 py-2 rounded-xl text-xs border ${cardBorder} ${darkMode ? 'bg-white/5 text-white placeholder-white/25' : 'bg-gray-50 text-gray-900 placeholder-gray-400'} focus:outline-none focus:ring-1 focus:ring-violet-500`} />
                    <button onClick={() => setShowKey(!showKey)} className={`absolute right-3 top-1/2 -translate-y-1/2 ${subtleText} hover:text-violet-400 transition-colors`}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        {showKey ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        ) : (
                          <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
                        )}
                      </svg>
                    </button>
                  </div>
                </div>

                <p className={`text-[10px] ${subtleText} mb-1`}>
                  Get your key at <span className="text-violet-400 font-medium">aistudio.google.com</span> — Veo requires billing enabled on your Google Cloud project
                </p>

                <button onClick={() => setHowToOpen(!howToOpen)}
                  className={`flex items-center gap-1 text-[10px] font-medium ${mutedText} hover:text-violet-400 transition-colors mb-3`}>
                  <svg className={`w-2.5 h-2.5 transition-transform duration-200 ${howToOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  How to get your key
                </button>
                {howToOpen && (
                  <div className={`mb-3 p-2.5 rounded-xl ${darkMode ? 'bg-white/[0.03]' : 'bg-gray-50'} text-[11px] ${mutedText} space-y-1`}>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center flex-shrink-0 text-[9px] font-bold">1</span>
                      <span>Go to <span className="text-violet-400 font-medium">aistudio.google.com</span></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center flex-shrink-0 text-[9px] font-bold">2</span>
                      <span>Sign in with Google &rarr; Click "Get API Key" &rarr; "Create API Key"</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center flex-shrink-0 text-[9px] font-bold">3</span>
                      <span>Enable billing on the linked Cloud project for Veo access</span>
                    </div>
                  </div>
                )}

                {genError && (
                  <div className={`mb-3 p-2.5 rounded-xl ${darkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                    <p className="text-red-400 text-xs">{genError}</p>
                  </div>
                )}

                {generating && (
                  <div className="mb-3 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className={`text-xs ${mutedText}`}>{genProgress}</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-1000" style={{ width: `${genPercent}%` }} />
                    </div>
                    <p className={`text-[10px] ${subtleText}`}>{genPercent}% — may take 30-120 seconds</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button onClick={generateAiVideo} disabled={!frontImage || !apiKey.trim() || generating}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2
                      ${!frontImage || !apiKey.trim() || generating
                        ? `${darkMode ? 'bg-white/10 text-white/30' : 'bg-gray-200 text-gray-400'} cursor-not-allowed`
                        : 'bg-gradient-to-r from-violet-500 to-pink-500 text-white hover:shadow-lg hover:shadow-violet-500/25 active:scale-[0.98]'}`}>
                    {generating ? 'Generating...' : (
                      <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Generate AI Video</>
                    )}
                  </button>
                  {videoUrl && (
                    <button onClick={downloadAiVideo}
                      className={`px-4 py-2.5 rounded-xl text-xs font-medium border ${cardBorder} ${darkMode ? 'text-white/70 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'} transition-all`}>
                      Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ─── Footer ──────────────────────────────────────────── */}
        <footer className={`text-center py-8 border-t ${darkMode ? 'border-white/5' : 'border-gray-100'}`}>
          <p className={`text-sm ${subtleText}`}>SpinShot — Make your products shine &#10024;</p>
        </footer>
      </div>

      <Toast message={toastMsg} visible={toastVisible} onHide={() => setToastVisible(false)} />
      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  )
}

// ─── GIF Encoder ────────────────────────────────────────────────────
function encodeGif(width, height, frames) {
  const buf = []
  const write = (b) => buf.push(b)
  const writes = (s) => { for (let i = 0; i < s.length; i++) write(s.charCodeAt(i)) }
  const writeShort = (v) => { write(v & 0xff); write((v >> 8) & 0xff) }
  const palette = buildPalette()
  writes('GIF89a'); writeShort(width); writeShort(height)
  write(0xf7); write(0); write(0)
  for (let i = 0; i < 256; i++) { write(palette[i*3]||0); write(palette[i*3+1]||0); write(palette[i*3+2]||0) }
  write(0x21); write(0xff); write(11); writes('NETSCAPE2.0'); write(3); write(1); writeShort(0); write(0)
  for (const frame of frames) {
    write(0x21); write(0xf9); write(4); write(0); writeShort(Math.round(frame.delay/10)); write(0); write(0)
    write(0x2c); writeShort(0); writeShort(0); writeShort(width); writeShort(height); write(0)
    const pixels = quantizeFrame(frame.data, palette)
    write(8); const compressed = lzwEncode(pixels, 8)
    let off = 0
    while (off < compressed.length) { const bs = Math.min(255, compressed.length - off); write(bs); for (let i = 0; i < bs; i++) write(compressed[off+i]); off += bs }
    write(0)
  }
  write(0x3b); return new Uint8Array(buf)
}
function buildPalette() {
  const p = new Uint8Array(256*3); let idx = 0
  for (let r = 0; r < 6; r++) for (let g = 0; g < 7; g++) for (let b = 0; b < 6; b++) {
    if (idx >= 256) break; p[idx*3]=Math.round(r*255/5); p[idx*3+1]=Math.round(g*255/6); p[idx*3+2]=Math.round(b*255/5); idx++
  }; return p
}
function quantizeFrame(imageData, palette) {
  const pixels = new Uint8Array(imageData.width*imageData.height), d = imageData.data
  for (let i = 0; i < pixels.length; i++) pixels[i] = Math.min(Math.round(d[i*4]*5/255)*42 + Math.round(d[i*4+1]*6/255)*6 + Math.round(d[i*4+2]*5/255), 255)
  return pixels
}
function lzwEncode(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize, eoiCode = clearCode + 1, output = []
  let codeSize = minCodeSize + 1, nextCode = eoiCode + 1, bitBuf = 0, bitCount = 0
  const emit = (code) => { bitBuf |= code << bitCount; bitCount += codeSize; while (bitCount >= 8) { output.push(bitBuf & 0xff); bitBuf >>= 8; bitCount -= 8 } }
  let table = new Map()
  const initTable = () => { table.clear(); for (let i = 0; i < clearCode; i++) table.set(String(i), i); nextCode = eoiCode + 1; codeSize = minCodeSize + 1 }
  initTable(); emit(clearCode)
  if (pixels.length === 0) { emit(eoiCode); if (bitCount > 0) output.push(bitBuf & 0xff); return output }
  let current = String(pixels[0])
  for (let i = 1; i < pixels.length; i++) {
    const next = current + ',' + pixels[i]
    if (table.has(next)) { current = next } else {
      emit(table.get(current))
      if (nextCode < 4096) { table.set(next, nextCode); if (nextCode > (1 << codeSize) - 1 && codeSize < 12) codeSize++; nextCode++ }
      else { emit(clearCode); initTable() }
      current = String(pixels[i])
    }
  }
  emit(table.get(current)); emit(eoiCode); if (bitCount > 0) output.push(bitBuf & 0xff); return output
}
