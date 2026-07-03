"use client"

import { useState } from "react"
import {
  Sparkles, Wand2, Loader2, Image as ImageIcon, Film, User,
  Palette, Sun, Monitor, Cpu, RatioIcon as AspectRatio, CuboidIcon as Cube
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"

type GenerationMode = "image" | "video" | "avatar"

function AIMultiModalGeneration() {
  const [mode, setMode] = useState<GenerationMode>("image")
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [prompt, setPrompt] = useState("")
  const [aiModel, setAiModel] = useState("stable-diffusion-xl")
  const [resolution, setResolution] = useState("1024x1024")

  const aiModels: Record<GenerationMode, { value: string; label: string }[]> = {
    image: [
      { value: "stable-diffusion-xl", label: "Stable Diffusion XL" },
      { value: "midjourney-v5", label: "Midjourney v5" },
      { value: "dalle-3", label: "DALL-E 3" },
    ],
    video: [
      { value: "gen-2", label: "Gen-2" },
      { value: "runway-gen-2", label: "Runway Gen-2" },
      { value: "sora", label: "Sora" },
    ],
    avatar: [
      { value: "dreamshaper-3d", label: "DreamShaper 3D" },
      { value: "meshy", label: "Meshy" },
      { value: "luma", label: "Luma AI" },
    ],
  }

  const resolutions: Record<GenerationMode, { value: string; label: string }[]> = {
    image: [
      { value: "512x512", label: "512x512" },
      { value: "1024x1024", label: "1024x1024" },
      { value: "1536x1536", label: "1536x1536" },
    ],
    video: [
      { value: "512x512", label: "512x512" },
      { value: "1024x576", label: "1024x576" },
      { value: "1280x720", label: "1280x720 HD" },
    ],
    avatar: [
      { value: "512x512", label: "512x512" },
      { value: "1024x1024", label: "1024x1024" },
      { value: "2048x2048", label: "2048x2048" },
    ],
  }

  const placeholderPrompts = {
    image: "Professional portrait with blue background, studio lighting",
    video: "Short video of a person walking in a park, cinematic lighting",
    avatar: "3D avatar of a young professional with glasses, detailed face",
  }

  const handleGenerate = () => {
    if (!prompt) return
    setIsLoading(true)
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsLoading(false)
          return 100
        }
        return prev + 2
      })
    }, 60)
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="border-border/50 bg-card/50 backdrop-blur-lg">
        <CardContent className="p-6">
          {/* Mode Tabs */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as GenerationMode)} className="mb-6">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="image" className="gap-2">
                <ImageIcon className="h-4 w-4" /> Image
              </TabsTrigger>
              <TabsTrigger value="video" className="gap-2">
                <Film className="h-4 w-4" /> Video
              </TabsTrigger>
              <TabsTrigger value="avatar" className="gap-2">
                <User className="h-4 w-4" /> Avatar
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Prompt Input */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="prompt" className="mb-2 block">Prompt</Label>
              <Textarea
                id="prompt"
                placeholder={placeholderPrompts[mode]}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>

            {/* Settings Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">AI Model</Label>
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {aiModels[mode].map((model) => (
                      <SelectItem key={model.value} value={model.value}>{model.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Resolution</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {resolutions[mode].map((res) => (
                      <SelectItem key={res.value} value={res.value}>{res.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isLoading || !prompt}
              className="w-full gap-2"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating... {progress}%
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Generate {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </>
              )}
            </Button>

            {/* Progress Bar */}
            {isLoading && (
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {/* Result Preview */}
            {!isLoading && progress === 100 && (
              <div className="mt-4 p-8 border border-dashed border-border rounded-xl text-center bg-muted/30">
                <Sparkles className="h-12 w-12 mx-auto text-primary mb-3" />
                <p className="text-muted-foreground">Generation complete! Your {mode} is ready.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export { AIMultiModalGeneration }
