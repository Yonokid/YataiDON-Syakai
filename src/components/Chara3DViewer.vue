<script setup lang="ts">
// Port of YataiDON's Chara3D (src/objects/global/chara_3d.cpp), default animation only.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const props = defineProps<{
  isCostume: boolean
  head: number
  body: number
  cos: number
  colors: [string, string, string]
  puchi: number
}>()

const BASE = `${import.meta.env.BASE_URL}costumes`
const GAME_SCALE = 650 // game pixels (at 720 lines) per model unit
const VIEW_HEIGHT = 0.68 // model units visible vertically
const VIEW_CENTER_Y = 0.24
const VIEW_ASPECT = 3 / 4
const SUPERSAMPLE = 2
const FACE_PLANE_SIZE = 0.137
const LOOP_SECONDS = 1.8 // don_normal: 3 beats at the game's default 100 BPM
// Face animation 46 in animation.json ("don_normal face"): [end ms, sheet frame]
const FACE_LOOP_MS = 1000
const FACE_FRAMES: [number, number][] = [
  [650, 4],
  [816.67, 0],
  [966.67, 7],
  [1000, 4],
]

// Where the game draws the puchichara relative to the model origin, in percent of the box
const PUCHI_SIZE = 150 / GAME_SCALE
const viewWidth = VIEW_HEIGHT * VIEW_ASPECT
const puchiStyle = {
  width: `${(PUCHI_SIZE / viewWidth) * 100}%`,
  left: `${(0.5 + (-90 / GAME_SCALE - PUCHI_SIZE / 2) / viewWidth) * 100}%`,
  top: `${(0.5 + (VIEW_CENTER_Y - 120 / GAME_SCALE - PUCHI_SIZE / 2) / VIEW_HEIGHT) * 100}%`,
}

const box = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const failed = ref(false)

const scene = new THREE.Scene()
// Same orientation as the game's default rot_x 181.25 / rot_y 27.5 seen through its y-down camera
scene.rotation.set(THREE.MathUtils.degToRad(1.25), THREE.MathUtils.degToRad(27.5), 0)
scene.updateMatrixWorld()
const camera = new THREE.OrthographicCamera(
  (-VIEW_HEIGHT * VIEW_ASPECT) / 2,
  (VIEW_HEIGHT * VIEW_ASPECT) / 2,
  VIEW_CENTER_Y + VIEW_HEIGHT / 2,
  VIEW_CENTER_Y - VIEW_HEIGHT / 2,
  -10,
  10,
)
const sceneTarget = new THREE.WebGLRenderTarget(1, 1)
const loader = new GLTFLoader()

const outlineUniforms = {
  outlineParam: { value: new THREE.Vector2(0, 0.3) },
  screenSize: { value: new THREE.Vector2(1, 1) },
}

// shader/outline.vs + outline.fs: inverted hull, thickness from the vertex colour's green channel
function outlineMaterial(map: THREE.Texture | null) {
  return new THREE.ShaderMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    transparent: true,
    uniforms: { ...outlineUniforms, map: { value: map } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <skinning_pars_vertex>
      uniform vec2 outlineParam;
      uniform vec2 screenSize;
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        vec3 objectNormal = normal;
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        vec3 transformed = position;
        #include <skinning_vertex>
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        vec3 n = normalize(normalMatrix * objectNormal);
        if (dot(n.xy, n.xy) > 1e-12) {
          clip.xy += outlineParam.x * color.g * normalize(n.xy) * 2.0 / screenSize * clip.w;
        }
        gl_Position = clip;
        vUv = uv;
        vFacing = n.z;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec2 outlineParam;
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        if (vFacing > outlineParam.y) discard;
        float a = texture2D(map, vUv).a;
        if (a <= 0.0) discard;
        gl_FragColor = vec4(0.05, 0.05, 0.05, a);
      }`,
  })
}

// shader/outline_fxaa.fs: dilates the character's silhouette into the black outer line
const silhouette = new FullScreenQuad(
  new THREE.ShaderMaterial({
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      scene: { value: sceneTarget.texture },
      texSize: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D scene;
      uniform vec2 texSize;
      varying vec2 vUv;
      void main() {
        vec4 center = texture2D(scene, vUv);
        float coverage = 0.0;
        for (int i = 0; i < 16; i++) {
          float angle = 6.28318530718 * (float(i) + 0.5) / 16.0;
          coverage = max(coverage, texture2D(scene, vUv + vec2(cos(angle), sin(angle)) / texSize * 3.0).a);
        }
        float alpha = max(coverage, center.a);
        if (alpha <= 0.0) discard;
        gl_FragColor = vec4(center.a > 0.0 ? center.rgb : vec3(0.0), alpha);
      }`,
  }),
)

interface Recolor {
  source: ImageData
  ctx: CanvasRenderingContext2D
  texture: THREE.CanvasTexture
}
interface Part {
  root: THREE.Group
  skeleton: THREE.Skeleton | null
  recolors: Recolor[]
  faceMaterials: THREE.MeshBasicMaterial[]
}
interface Rig {
  mixer: THREE.AnimationMixer
  bones: THREE.Bone[]
  parents: number[]
  t: THREE.Vector3[]
  r: THREE.Quaternion[]
  s: THREE.Vector3[]
  poses: Map<string, THREE.Matrix4>
}

let parts: Part[] = []
let renderer: THREE.WebGLRenderer | null = null
let observer: ResizeObserver | null = null
let frameId = 0
let loadId = 0
let faceTextures: THREE.CanvasTexture[] = []
let currentFace = -1
let elapsedMs = 0
let lastFrameMs = 0
let rig: Promise<Rig> | null = null
let activeRig: Rig | null = null

// animations.glb has its own, flatter skeleton than the models, so like the game this poses that
// skeleton and model bones copy the result by name
function loadRig() {
  rig ??= loader.loadAsync(`${BASE}/animations.glb`).then((gltf) => {
    const clip = gltf.animations.find((a) => a.name === 'don_normal')!
    const mixer = new THREE.AnimationMixer(gltf.scene)
    const action = mixer.clipAction(clip)
    action.timeScale = clip.duration / LOOP_SECONDS
    action.play()
    const bones: THREE.Bone[] = []
    gltf.scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone)
    })
    activeRig = {
      mixer,
      bones,
      parents: bones.map((b) => bones.indexOf(b.parent as THREE.Bone)),
      t: bones.map(() => new THREE.Vector3()),
      r: bones.map(() => new THREE.Quaternion()),
      s: bones.map(() => new THREE.Vector3()),
      poses: new Map(bones.map((b) => [b.name, new THREE.Matrix4()])),
    }
    return activeRig
  })
  return rig
}

// The game samples these textures with point filtering and no mipmaps. Some are tiny colour keys
// (128x8) with red and blue texels side by side, which linear filtering smears into a gradient.
function pointSampled<T extends THREE.Texture>(texture: T) {
  texture.minFilter = texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  return texture
}

async function loadFaceTextures() {
  const image = await new THREE.ImageBitmapLoader().loadAsync(`${BASE}/face/face_000000.png`)
  // Frames are square and stacked vertically
  const size = image.width
  faceTextures = Array.from({ length: Math.floor(image.height / size) }, (_, frame) => {
    const crop = document.createElement('canvas')
    crop.width = crop.height = size
    crop.getContext('2d')!.drawImage(image, 0, -frame * size)
    const texture = pointSampled(new THREE.CanvasTexture(crop))
    texture.flipY = false
    return texture
  })
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
}

// recolor_texture(): red-, green- and blue-keyed texels become the body, face and rim colours
function applyRecolor({ source, ctx, texture }: Recolor) {
  const body = hexToRgb(props.colors[0])
  const face = hexToRgb(props.colors[1])
  const rim = hexToRgb(props.colors[2])
  const out = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height)
  const px = out.data
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]!
    const g = px[i + 1]!
    const b = px[i + 2]!
    const strongest = Math.max(r, g, b)
    if (strongest <= 0.05 * 255 || strongest - Math.min(r, g, b) <= 0.08 * 255) continue
    const color = b > r && b >= g ? rim : g > r && g > b ? face : body
    px[i] = color[0]
    px[i + 1] = color[1]
    px[i + 2] = color[2]
  }
  ctx.putImageData(out, 0, 0)
  texture.needsUpdate = true
}

function makeRecolor(map: THREE.Texture): Recolor {
  const image = map.image as ImageBitmap
  const recolorCanvas = document.createElement('canvas')
  recolorCanvas.width = image.width
  recolorCanvas.height = image.height
  const ctx = recolorCanvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0)
  const texture = pointSampled(new THREE.CanvasTexture(recolorCanvas))
  texture.flipY = false
  texture.wrapS = map.wrapS
  texture.wrapT = map.wrapT
  return { source: ctx.getImageData(0, 0, image.width, image.height), ctx, texture }
}

// normalize_face_mesh_size(): scales the face plane about its centre
function normalizeFacePlane(mesh: THREE.Mesh, always: boolean) {
  const geometry = mesh.geometry
  geometry.computeBoundingBox()
  const { min, max } = geometry.boundingBox!
  const size = Math.max(max.x - min.x, max.y - min.y)
  if (size <= 0.0001 || (!always && size <= FACE_PLANE_SIZE * 1.02)) return
  const center = min.clone().add(max).multiplyScalar(0.5)
  const factor = FACE_PLANE_SIZE / size
  const position = geometry.attributes.position!
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(
      i,
      center.x + (position.getX(i) - center.x) * factor,
      center.y + (position.getY(i) - center.y) * factor,
      center.z + (position.getZ(i) - center.z) * factor,
    )
  }
}

async function loadPart(url: string, isHead: boolean): Promise<Part> {
  const { scene: root } = await loader.loadAsync(url)
  const part: Part = { root, skeleton: null, recolors: [], faceMaterials: [] }

  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) part.skeleton = (o as THREE.SkinnedMesh).skeleton
  })
  // World matrices are written by applyPose() instead
  part.skeleton?.bones.forEach((b) => (b.matrixWorldAutoUpdate = false))

  meshes.forEach((mesh, index) => {
    const src = mesh.material as THREE.MeshStandardMaterial
    const name = src.name.toLowerCase()
    const shaderType = src.userData.shaderType
    const isFace = shaderType === 'taikoEffectFace'
    const isCutout = name.includes('_color_s_cus_') && !name.includes('_a_ab')
    const isBlend = !isFace && (name.includes('_a_ab') || (src.transparent && !isCutout))
    let map = src.map
    if (map) {
      map.colorSpace = THREE.NoColorSpace // the game draws texels unconverted
      pointSampled(map)
    }

    if (shaderType === 'taikoEffectChangeColors' && map) {
      const recolor = makeRecolor(map)
      applyRecolor(recolor)
      part.recolors.push(recolor)
      map = recolor.texture
    }

    const material = new THREE.MeshBasicMaterial({
      map,
      // Everything is drawn in mesh order with blending and depth writes, as in the game
      transparent: true,
      depthWrite: true,
      alphaTest: isFace ? 0 : 1 / 512,
      side: name.includes('cullnone') ? THREE.DoubleSide : THREE.FrontSide,
      color: name.includes('_aa_add') && !isFace ? 0xffffff : src.color,
      opacity: src.opacity,
    })
    if (isFace) {
      normalizeFacePlane(mesh, isHead)
      part.faceMaterials.push(material)
    }
    mesh.material = material
    mesh.frustumCulled = false
    // draw_model_face_last(): opaque and alpha-tested, then the face, then alpha-blended sheets
    mesh.renderOrder = (isFace ? 1000 : isBlend ? 2000 : 0) + index

    if (!isFace) {
      const hull = mesh.clone()
      hull.material = outlineMaterial(map)
      hull.renderOrder = 3000 + index
      mesh.parent!.add(hull)
    }
  })

  return part
}

// build_pose_from_parents(): rotation, scale and translation inherit separately, so unlike a
// matrix chain a nonuniformly scaled bone doesn't shear its children
function updateRigPose({ bones, parents, t, r, s, poses }: Rig) {
  bones.forEach((bone, i) => {
    t[i]!.copy(bone.position)
    r[i]!.copy(bone.quaternion)
    s[i]!.copy(bone.scale)
    const p = parents[i]!
    if (p >= 0) {
      r[i]!.premultiply(r[p]!)
      s[i]!.multiply(s[p]!)
      t[i]!.multiply(s[p]!).applyQuaternion(r[p]!).add(t[p]!)
    }
    poses.get(bone.name)!.compose(t[i]!, r[i]!, s[i]!)
  })
}

const bindPose = new THREE.Matrix4()

function applyPose({ skeleton }: Part, { poses }: Rig) {
  skeleton?.bones.forEach((bone, i) => {
    // Bones the animation doesn't know are held at the model's bind pose
    const pose = poses.get(bone.name) ?? bindPose.copy(skeleton.boneInverses[i]!).invert()
    bone.matrixWorld.multiplyMatrices(scene.matrixWorld, pose)
    bone.matrixWorldNeedsUpdate = true
  })
}

function disposePart(part: Part) {
  part.root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const material = mesh.material as THREE.MeshBasicMaterial
    material.map?.dispose()
    material.dispose()
  })
  scene.remove(part.root)
}

async function loadCharacter() {
  const id = ++loadId
  const urls: [string, boolean][] = props.isCostume
    ? [[`${BASE}/cos/${props.cos}.glb`, false]]
    : [
        [`${BASE}/body/${props.body}.glb`, false],
        [`${BASE}/head/${props.head}.glb`, true],
      ]
  try {
    await loadRig()
    const loaded = await Promise.all(urls.map(([url, isHead]) => loadPart(url, isHead)))
    if (id !== loadId) {
      loaded.forEach(disposePart)
      return
    }
    parts.forEach(disposePart)
    parts = loaded
    // Body goes first so the head draws over it, as the game's load_part order does
    parts.forEach((part) => scene.add(part.root))
    currentFace = -1
    failed.value = false
  } catch {
    if (id === loadId) failed.value = true
  }
}

function updateFace() {
  const t = elapsedMs % FACE_LOOP_MS
  const frame = FACE_FRAMES.find(([end]) => t < end)![1]
  if (frame === currentFace) return
  currentFace = frame
  const texture = faceTextures[frame]
  if (!texture) return
  for (const part of parts) {
    for (const material of part.faceMaterials) {
      material.map = texture
      material.needsUpdate = true
    }
  }
}

function resize() {
  const width = box.value!.clientWidth
  const height = box.value!.clientHeight
  const dpr = window.devicePixelRatio
  renderer!.setPixelRatio(dpr)
  renderer!.setSize(width, height, false)
  const targetW = Math.round(width * dpr * SUPERSAMPLE)
  const targetH = Math.round(height * dpr * SUPERSAMPLE)
  sceneTarget.setSize(targetW, targetH)
  outlineUniforms.screenSize.value.set(targetW, targetH)
  // The game's 2.5 px at 650 px per unit, kept proportional to the model at this zoom
  outlineUniforms.outlineParam.value.x = (2.5 / GAME_SCALE) * (targetH / VIEW_HEIGHT)
  const uniforms = (silhouette.material as THREE.ShaderMaterial).uniforms
  uniforms.texSize!.value.set(targetW, targetH)
}

function renderFrame() {
  frameId = requestAnimationFrame(renderFrame)
  const now = performance.now()
  const dt = lastFrameMs ? (now - lastFrameMs) / 1000 : 0
  lastFrameMs = now
  elapsedMs += dt * 1000
  if (activeRig) {
    const currentRig = activeRig
    currentRig.mixer.update(dt)
    updateRigPose(currentRig)
    parts.forEach((part) => applyPose(part, currentRig))
  }
  updateFace()
  renderer!.setRenderTarget(sceneTarget)
  renderer!.setClearColor(0x000000, 0)
  renderer!.clear()
  renderer!.render(scene, camera)
  renderer!.setRenderTarget(null)
  renderer!.clear()
  silhouette.render(renderer!)
}

onMounted(async () => {
  try {
    // premultipliedAlpha off: the silhouette pass outputs straight alpha over the CSS gradient
    renderer = new THREE.WebGLRenderer({
      canvas: canvas.value,
      alpha: true,
      premultipliedAlpha: false,
    })
  } catch {
    failed.value = true // no WebGL
    return
  }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace
  renderer.autoClear = false
  resize()
  observer = new ResizeObserver(resize)
  observer.observe(box.value!)
  renderFrame()
  await Promise.all([loadFaceTextures(), loadCharacter()]).catch(() => (failed.value = true))
})

onBeforeUnmount(() => {
  loadId++
  cancelAnimationFrame(frameId)
  observer?.disconnect()
  parts.forEach(disposePart)
  faceTextures.forEach((t) => t.dispose())
  sceneTarget.dispose()
  silhouette.dispose()
  renderer?.dispose()
})

watch(() => [props.isCostume, props.head, props.body, props.cos], loadCharacter)
watch(
  () => props.colors,
  () => parts.forEach((part) => part.recolors.forEach(applyRecolor)),
)
</script>

<template>
  <div
    ref="box"
    class="relative aspect-[3/4] w-full overflow-hidden rounded-md border border-neutral-300 bg-gradient-to-b from-white to-sky-200 dark:border-neutral-700"
  >
    <canvas ref="canvas" class="block h-full w-full" />
    <div
      v-if="puchi > 0"
      class="puchi absolute aspect-square"
      :style="[puchiStyle, { backgroundImage: `url(${BASE}/acce/${puchi}.png)` }]"
    />
    <p v-if="failed" class="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-neutral-700">
      {{ $t('user.previewError') }}
    </p>
  </div>
</template>

<style scoped>
/* draw_puchi(): two frames stacked vertically, 850 ms each, with a 6 game-pixel bob */
.puchi {
  background-size: 100% 200%;
  animation:
    puchi-frame 1.7s steps(1) infinite,
    puchi-bob 1.7s ease-in-out infinite;
}
@keyframes puchi-frame {
  0% {
    background-position: 0 0;
  }
  50% {
    background-position: 0 100%;
  }
}
@keyframes puchi-bob {
  0%,
  50%,
  100% {
    translate: 0 0;
  }
  25% {
    translate: 0 4%;
  }
  75% {
    translate: 0 -4%;
  }
}
</style>
