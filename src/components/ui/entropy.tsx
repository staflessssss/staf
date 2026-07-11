'use client'

import { useEffect, useRef } from 'react'

interface EntropyProps {
  className?: string
  size?: number
}

const MAX_DEVICE_PIXEL_RATIO = 2
const GRID_SIZE = 25
const INFLUENCE_RADIUS = 100
const LINK_RADIUS = 50

export function Entropy({ className = '', size = 400 }: EntropyProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logicalSize = Math.max(1, size)

  useEffect(() => {
    const currentContainer = containerRef.current
    const currentCanvas = canvasRef.current
    if (!currentContainer || !currentCanvas) return

    const currentContext = currentCanvas.getContext('2d')
    if (!currentContext) return

    // Stable non-null aliases are safe to capture in animation callbacks.
    const container = currentContainer
    const canvas = currentCanvas
    const context = currentContext

    const particleColor = '#ffffff'

    class Particle {
      x: number
      y: number
      size = 2
      order: boolean
      velocity: { x: number; y: number }
      originalX: number
      originalY: number
      influence = 0
      influencers: Particle[] = []

      constructor(x: number, y: number, order: boolean) {
        this.x = x
        this.y = y
        this.originalX = x
        this.originalY = y
        this.order = order
        this.velocity = {
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
        }
      }

      update() {
        if (this.order) {
          const dx = this.originalX - this.x
          const dy = this.originalY - this.y
          const chaosInfluence = { x: 0, y: 0 }

          this.influencers.forEach((neighbor) => {
            const distance = Math.hypot(this.x - neighbor.x, this.y - neighbor.y)
            const strength = Math.max(0, 1 - distance / INFLUENCE_RADIUS)
            chaosInfluence.x += neighbor.velocity.x * strength
            chaosInfluence.y += neighbor.velocity.y * strength
            this.influence = Math.max(this.influence, strength)
          })

          this.x += dx * 0.05 * (1 - this.influence) + chaosInfluence.x * this.influence
          this.y += dy * 0.05 * (1 - this.influence) + chaosInfluence.y * this.influence
          this.influence *= 0.99
          return
        }

        this.velocity.x += (Math.random() - 0.5) * 0.5
        this.velocity.y += (Math.random() - 0.5) * 0.5
        this.velocity.x *= 0.95
        this.velocity.y *= 0.95
        this.x += this.velocity.x
        this.y += this.velocity.y

        if (this.x < logicalSize / 2 || this.x > logicalSize) this.velocity.x *= -1
        if (this.y < 0 || this.y > logicalSize) this.velocity.y *= -1
        this.x = Math.max(logicalSize / 2, Math.min(logicalSize, this.x))
        this.y = Math.max(0, Math.min(logicalSize, this.y))
      }

      draw() {
        const alpha = this.order ? 0.8 - this.influence * 0.5 : 0.8
        context.fillStyle = `${particleColor}${Math.round(alpha * 255)
          .toString(16)
          .padStart(2, '0')}`
        context.beginPath()
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2)
        context.fill()
      }
    }

    const particles: Particle[] = []
    const spacing = logicalSize / GRID_SIZE

    for (let column = 0; column < GRID_SIZE; column++) {
      for (let row = 0; row < GRID_SIZE; row++) {
        const x = spacing * column + spacing / 2
        const y = spacing * row + spacing / 2
        particles.push(new Particle(x, y, x < logicalSize / 2))
      }
    }

    // Flat index pairs avoid allocating thousands of short-lived pair objects.
    const linkedParticleIndexes: number[] = []

    function updateRelationships() {
      linkedParticleIndexes.length = 0
      particles.forEach((particle) => {
        particle.influencers = []
      })

      for (let firstIndex = 0; firstIndex < particles.length; firstIndex++) {
        const first = particles[firstIndex]

        for (let secondIndex = firstIndex + 1; secondIndex < particles.length; secondIndex++) {
          const second = particles[secondIndex]
          const dx = first.x - second.x
          const dy = first.y - second.y
          const distanceSquared = dx * dx + dy * dy

          if (distanceSquared < LINK_RADIUS * LINK_RADIUS) {
            linkedParticleIndexes.push(firstIndex, secondIndex)
          }

          if (distanceSquared >= INFLUENCE_RADIUS * INFLUENCE_RADIUS) continue
          if (first.order && !second.order) first.influencers.push(second)
          if (second.order && !first.order) second.influencers.push(first)
        }
      }
    }

    function drawLinks() {
      const opacityBuckets = [0.035, 0.085, 0.135, 0.185]
      const paths = opacityBuckets.map(() => new Path2D())

      context.lineWidth = 0.5

      for (let index = 0; index < linkedParticleIndexes.length; index += 2) {
        const first = particles[linkedParticleIndexes[index]]
        const second = particles[linkedParticleIndexes[index + 1]]
        const distance = Math.hypot(first.x - second.x, first.y - second.y)
        if (distance >= LINK_RADIUS) continue

        const strength = 1 - distance / LINK_RADIUS
        const bucketIndex = Math.min(
          opacityBuckets.length - 1,
          Math.floor(strength * opacityBuckets.length),
        )
        const path = paths[bucketIndex]
        path.moveTo(first.x, first.y)
        path.lineTo(second.x, second.y)
      }

      paths.forEach((path, index) => {
        context.strokeStyle = `rgba(255, 255, 255, ${opacityBuckets[index]})`
        context.stroke(path)
      })
    }

    function drawScene(advance: boolean, time: number) {
      context.clearRect(0, 0, logicalSize, logicalSize)

      if (advance) {
        if (time % 30 === 0) updateRelationships()
        particles.forEach((particle) => particle.update())
      }

      drawLinks()
      particles.forEach((particle) => particle.draw())

      context.strokeStyle = `${particleColor}4D`
      context.lineWidth = 0.5
      context.beginPath()
      context.moveTo(logicalSize / 2, 0)
      context.lineTo(logicalSize / 2, logicalSize)
      context.stroke()
    }

    function resizeCanvas() {
      const bounds = canvas.getBoundingClientRect()
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), MAX_DEVICE_PIXEL_RATIO)
      const backingWidth = Math.max(1, Math.round(bounds.width * dpr))
      const backingHeight = Math.max(1, Math.round(bounds.height * dpr))

      if (canvas.width !== backingWidth) canvas.width = backingWidth
      if (canvas.height !== backingHeight) canvas.height = backingHeight

      context.setTransform(
        backingWidth / logicalSize,
        0,
        0,
        backingHeight / logicalSize,
        0,
        0,
      )
    }

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let prefersReducedMotion = motionPreference.matches
    let isDocumentVisible = document.visibilityState === 'visible'
    let isIntersecting = typeof IntersectionObserver === 'undefined'
    let animationFrame: number | null = null
    let time = 0

    updateRelationships()

    if (prefersReducedMotion) {
      // Establish the ordered/chaotic contrast without presenting visible motion.
      for (let step = 0; step < 45; step++) {
        if (step % 15 === 0) updateRelationships()
        particles.forEach((particle) => particle.update())
      }
      time = 45
      updateRelationships()
    }

    resizeCanvas()
    drawScene(false, time)

    const shouldAnimate = () => !prefersReducedMotion && isDocumentVisible && isIntersecting

    function stopAnimation() {
      if (animationFrame === null) return
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }

    function animate() {
      animationFrame = null
      if (!shouldAnimate()) return

      drawScene(true, time)
      time += 1
      animationFrame = requestAnimationFrame(animate)
    }

    function syncAnimation() {
      if (!shouldAnimate()) {
        stopAnimation()
        return
      }

      if (animationFrame === null) animationFrame = requestAnimationFrame(animate)
    }

    function handleVisibilityChange() {
      isDocumentVisible = document.visibilityState === 'visible'
      syncAnimation()
    }

    function handleMotionPreferenceChange(event: MediaQueryListEvent) {
      prefersReducedMotion = event.matches
      if (prefersReducedMotion) drawScene(false, time)
      syncAnimation()
    }

    function handleResize() {
      resizeCanvas()
      drawScene(false, time)
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)

    const intersectionObserver =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              isIntersecting = entry.isIntersecting
              syncAnimation()
            },
            { threshold: 0.01 },
          )

    intersectionObserver?.observe(container)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('resize', handleResize, { passive: true })
    motionPreference.addEventListener('change', handleMotionPreferenceChange)
    syncAnimation()

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      intersectionObserver?.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('resize', handleResize)
      motionPreference.removeEventListener('change', handleMotionPreferenceChange)
    }
  }, [logicalSize])

  return (
    <div
      ref={containerRef}
      className={`relative min-w-0 ${className}`}
      style={{
        width: `clamp(1px, calc(100vw - 2rem), ${logicalSize}px)`,
        maxWidth: '100%',
        aspectRatio: '1 / 1',
      }}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
    </div>
  )
}
