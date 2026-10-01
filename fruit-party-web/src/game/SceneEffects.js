import * as THREE from 'three'
import { FRUIT_CATALOG } from './fruitCatalog'

const material = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.58, ...options })

const CUT_PROFILES = Object.freeze({
  apple: { skin: 0xc91f35, flesh: 0xffe7bd, core: 0xf3cfa0, shape: [0.96, 0.9], seeds: 3, seed: 0x5a2c18 },
  orange: { skin: 0xef7f18, flesh: 0xffa329, core: 0xffd27a, shape: [1, 1], segments: 8 },
  watermelon: { skin: 0x27733d, rind: 0xd8efb0, flesh: 0xf04455, core: 0xf04455, shape: [1.18, 0.84], seeds: 8, seed: 0x17151a },
  banana: { skin: 0xe9bb27, flesh: 0xffe6a0, core: 0xe8c879, shape: [0.72, 1], seeds: 0, seed: 0x704b25 },
  pineapple: { skin: 0xa97822, flesh: 0xf3c946, core: 0xffe77d, shape: [0.82, 1.08], segments: 6 },
  kiwi: { skin: 0x674127, flesh: 0x89b942, core: 0xe9e6b3, shape: [0.9, 1], seeds: 12, seed: 0x171713 },
  strawberry: { skin: 0xc9233b, flesh: 0xf36a78, core: 0xffb2ad, shape: [0.86, 1.05], seeds: 5, seed: 0xffd36a },
  dragonfruit: { skin: 0xe94586, flesh: 0xf7f1e9, core: 0xffffff, shape: [0.9, 1.04], seeds: 14, seed: 0x232027 },
  // 哈密瓜切面是淡绿皮圈包住橙色果肉；籽较集中在中心附近。
  cantaloupe: { skin: 0xb69848, rind: 0xd9d37a, flesh: 0xf2ad66, core: 0xffd18a, shape: [1.12, 0.88], seeds: 10, seed: 0x8b6e33 },
  // 梨的外皮较薄、果肉偏浅黄；半球切面沿用通用平滑外壳以避免形成台阶。
  pear: { skin: 0x91a93a, rind: 0xabc157, flesh: 0xf3e4b5, core: 0xd6c98a, shape: [0.86, 1.12], seeds: 4, seed: 0x5a3b21 },
})

function particleVelocity(index, speed = 1) {
  const angle = index * 2.399963
  const lift = 0.35 + (index % 5) * 0.12
  return new THREE.Vector3(Math.cos(angle) * speed * (0.45 + (index % 3) * 0.16), Math.sin(angle) * speed * 0.55 + lift, (index % 2 ? 1 : -1) * speed * 0.12)
}

function cutDisk(radius, depth, color, name) {
  const disk = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.02, depth, 28),
    material(color, { roughness: 0.66 }),
  )
  disk.name = name
  disk.rotation.x = Math.PI / 2
  disk.castShadow = true
  return disk
}

function cutRing(innerRadius, outerRadius, color, name) {
  // RingGeometry 只保留一圈薄皮，不会像一个带倒角的实心椭圆那样形成多余的“脱皮层”。
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(innerRadius, outerRadius, 48),
    material(color, { roughness: 0.6 }),
  )
  ring.name = name
  ring.castShadow = true
  ring.receiveShadow = true
  return ring
}

function cutSurface(radius, color, name) {
  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    material(color, { roughness: 0.66 }),
  )
  surface.name = name
  surface.castShadow = true
  surface.receiveShadow = true
  return surface
}

function addCutDetails(piece, type, profile, faceDepth = 0.245) {
  if (profile.core && type !== 'dragonfruit') {
    const core = cutDisk(0.085, 0.022, profile.core, `${type}-core`)
    core.position.z = faceDepth - 0.02
    core.scale.set(...profile.shape, 1)
    piece.add(core)
  }

  if (profile.segments) {
    for (let index = 0; index < profile.segments; index += 1) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(0.009, 0.22, 0.012),
        material(profile.core || 0xffe5a0, { roughness: 0.7 }),
      )
      line.position.z = faceDepth - 0.01
      line.rotation.z = (index / profile.segments) * Math.PI
      piece.add(line)
    }
  }

  for (let index = 0; index < (profile.seeds || 0); index += 1) {
    const angle = index * 2.399963
    const radius = type === 'kiwi' || type === 'dragonfruit' ? 0.14 : 0.085 + (index % 2) * 0.045
    const seed = new THREE.Mesh(
      new THREE.SphereGeometry(type === 'dragonfruit' ? 0.012 : 0.018, 7, 6),
      material(profile.seed, { roughness: 0.72 }),
    )
    seed.name = `${type}-seed`
    seed.position.set(Math.cos(angle) * radius * profile.shape[0], Math.sin(angle) * radius * profile.shape[1], faceDepth)
    seed.scale.set(0.72, 1.45, 0.55)
    seed.rotation.z = angle
    seed.castShadow = true
    piece.add(seed)
  }
}

function createHalfCylinderGeometry(curve, tubularSegments = 22, radialSegments = 12, radius = 0.17, side = -1) {
  // TubeGeometry 默认是完整圆管；这里仅生成半圆截面，留下香蕉的平切面和真实厚度。
  const frames = curve.computeFrenetFrames(tubularSegments, false)
  const positions = []
  const indices = []

  for (let tubeIndex = 0; tubeIndex <= tubularSegments; tubeIndex += 1) {
    const point = curve.getPointAt(tubeIndex / tubularSegments)
    const normal = frames.normals[tubeIndex]
    const binormal = frames.binormals[tubeIndex]
    for (let radialIndex = 0; radialIndex <= radialSegments; radialIndex += 1) {
      // 让两条边落在屏幕可见的平切面上，弧面向镜头鼓起，避免整截看成薄片。
      const thetaStart = side < 0 ? -Math.PI / 2 : Math.PI / 2
      const theta = thetaStart + Math.PI * (radialIndex / radialSegments)
      const vertex = point.clone()
        .addScaledVector(normal, Math.cos(theta) * radius)
        .addScaledVector(binormal, Math.sin(theta) * radius)
      positions.push(vertex.x, vertex.y, vertex.z)
    }
  }

  const rowSize = radialSegments + 1
  for (let tubeIndex = 0; tubeIndex < tubularSegments; tubeIndex += 1) {
    for (let radialIndex = 0; radialIndex < radialSegments; radialIndex += 1) {
      const current = tubeIndex * rowSize + radialIndex
      const next = current + rowSize
      indices.push(current, next, current + 1, next, next + 1, current + 1)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.name = 'HalfCylinderGeometry'
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createBananaCurve() {
  const points = [
    new THREE.Vector3(-0.9, 0.24, 0),
    new THREE.Vector3(-0.7, 0.04, 0),
    new THREE.Vector3(-0.42, -0.12, 0),
    new THREE.Vector3(0, -0.18, 0),
    new THREE.Vector3(0.42, -0.12, 0),
    new THREE.Vector3(0.7, 0.04, 0),
    new THREE.Vector3(0.9, 0.24, 0),
  ]
  return new THREE.CatmullRomCurve3(points, false, 'centripetal')
}

function normalizeCutGroup(group, targetSize) {
  group.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(group)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const factor = targetSize / Math.max(size.x, size.y, size.z)
  group.children.forEach((child) => child.position.sub(center))
  group.scale.setScalar(factor)
  group.updateMatrixWorld(true)
}

// 切片在展开前已经带有倾斜角度。以旋转后的可见外接尺寸二次定标，
// 才能和命中前的整果保持同一视觉直径。
function matchCutVisualEnvelope(group, targetSize) {
  group.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(group)
  const size = box.getSize(new THREE.Vector3())
  const visibleSize = Math.max(size.x, size.y, size.z)
  if (visibleSize > 0) group.scale.multiplyScalar(targetSize / visibleSize)
  group.updateMatrixWorld(true)
}

function createBananaCutFace(piece, curve, endT, profile) {
  // TubeGeometry 不带端盖；这里在内侧端点补一张垂直于香蕉轴线的切面。
  // 皮圈、果肉和浅色芯共面，避免出现多余的“脱皮台阶”。
  const point = curve.getPointAt(endT)
  const tangent = curve.getTangentAt(endT).normalize()
  const face = new THREE.Group()
  face.position.copy(point)
  face.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent)

  const skin = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.175, 28),
    material(profile.skin, { roughness: 0.48, side: THREE.DoubleSide }),
  )
  skin.name = 'banana-cut-skin'
  skin.position.z = 0.002
  face.add(skin)

  const flesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 28),
    material(profile.flesh, { roughness: 0.72, side: THREE.DoubleSide }),
  )
  flesh.name = 'banana-flesh'
  flesh.position.z = 0.003
  face.add(flesh)

  const core = new THREE.Mesh(
    new THREE.CircleGeometry(0.027, 16),
    material(profile.core, { roughness: 0.78, side: THREE.DoubleSide }),
  )
  core.name = 'banana-core'
  core.position.z = 0.005
  face.add(core)
  piece.add(face)
}

function createBananaTransverse(direction, profile) {
  // 沿香蕉宽度方向横断，得到两段仍然保持弯曲和圆柱厚度的香蕉。
  const curve = createBananaCurve()
  const startT = direction < 0 ? 0 : 0.51
  const endT = direction < 0 ? 0.49 : 1
  const segmentCurve = new THREE.CatmullRomCurve3(
    curve.getPoints(32).filter((_, index) => {
      const t = index / 32
      return t >= startT && t <= endT
    }),
    false,
    'centripetal',
  )
  const piece = new THREE.Group()
  piece.name = 'sliced-half'
  piece.userData.sliceStyle = 'banana-transverse'

  const body = new THREE.Mesh(
    new THREE.TubeGeometry(segmentCurve, 22, 0.17, 12, false),
    material(profile.skin, { roughness: 0.46 }),
  )
  body.name = 'banana-cut-body'
  body.userData.shape = 'cylinder-segment'
  body.castShadow = true
  piece.add(body)

  createBananaCutFace(piece, segmentCurve, direction < 0 ? 1 : 0, profile)

  return piece
}

function createSlicedHalf(type, direction) {
  const profile = CUT_PROFILES[type] || CUT_PROFILES.apple
  const config = FRUIT_CATALOG[type] || FRUIT_CATALOG.apple
  // 完整模型和切开模型共用 catalog 的 scale，杜绝切开后突然缩成固定大小。
  const sliceScale = config.scale
  const piece = new THREE.Group()
  piece.name = 'sliced-half'

  if (type === 'banana') {
    const bananaPiece = createBananaTransverse(direction, profile)
    normalizeCutGroup(bananaPiece, sliceScale)
    bananaPiece.position.set(direction * 0.1 * sliceScale, direction * 0.045 * sliceScale, 0.06 + direction * 0.02)
    bananaPiece.userData.keepShape = true
    bananaPiece.userData.velocity = new THREE.Vector3(direction * 0.5, 0.42 + (direction > 0 ? 0.08 : 0), direction * 0.07)
    bananaPiece.userData.spin = new THREE.Vector3(1.4 * direction, 1.1, 1.8 * direction)
    return bananaPiece
  } else if (type === 'dragonfruit') {
    // SphereGeometry 只保留半球，旋转后切口朝向镜头；这是真正的“切半”外壳。
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      material(profile.skin, { roughness: 0.62 }),
    )
    body.name = 'dragonfruit-cut-body'
    body.rotation.x = -Math.PI / 2
    body.scale.set(profile.shape[0], profile.shape[1], 0.72)
    body.castShadow = true
    piece.add(body)

    // 皮圈与果肉是完全同一平面上的两块平面几何：没有底盘、厚度或前后高低差。
    const skin = cutRing(0.253, 0.29, profile.skin, 'dragonfruit-cut-skin')
    skin.position.z = 0.003
    skin.scale.set(...profile.shape, 1)
    piece.add(skin)

    const flesh = cutSurface(0.253, profile.flesh, 'dragonfruit-flesh')
    flesh.position.z = skin.position.z
    flesh.scale.set(profile.shape[0] * 0.98, profile.shape[1] * 0.98, 1)
    piece.add(flesh)
    addCutDetails(piece, type, profile, 0.018)
  } else {
    // 普通水果也使用真正的半球外壳：保留圆润曲面，切面朝向镜头，避免整球压扁后像石墩。
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2),
      material(profile.skin, { roughness: 0.5 }),
    )
    shell.name = `${type}-cut-body`
    shell.rotation.x = -Math.PI / 2
    shell.scale.set(profile.shape[0], profile.shape[1], 0.62)
    shell.position.z = 0
    shell.castShadow = true
    piece.add(shell)

    const rind = cutRing(0.225, 0.29, profile.rind || profile.skin, `${type}-rind`)
    rind.position.z = 0.003
    rind.scale.set(...profile.shape, 1)
    piece.add(rind)

    const flesh = cutSurface(0.225, profile.flesh, `${type}-flesh`)
    flesh.position.z = rind.position.z
    flesh.scale.set(profile.shape[0] * 0.96, profile.shape[1] * 0.96, 1)
    piece.add(flesh)
    addCutDetails(piece, type, profile, 0.024)
  }

  // 切片和完整水果使用同一外接盒目标尺寸，避免半球原始半径导致切开后整体缩小。
  normalizeCutGroup(piece, sliceScale)
  piece.rotation.set(-0.12, direction * 0.12, direction * 0.18)
  matchCutVisualEnvelope(piece, sliceScale)
  // 位移也按尺寸增长，西瓜和哈密瓜切开后能保持自然的分离距离。
  piece.position.set(direction * 0.16 * sliceScale, direction * 0.035 * sliceScale, 0.06)
  // 火龙果需要保持平整半球切面，不能在飞散过程中翻到侧面。
  piece.userData.keepShape = true
  piece.userData.velocity = new THREE.Vector3(direction * 0.5, 0.42 + (direction > 0 ? 0.08 : 0), direction * 0.07)
  piece.userData.spin = new THREE.Vector3(1.4 * direction, 1.1, 1.8 * direction)
  return piece
}

function clampToBoard(position, radius = 2.65) {
  const point = new THREE.Vector2(position.x + 0.08, position.y - 0.12)
  if (point.length() > radius) point.setLength(radius)
  return point
}

export function createJuiceEffect(position, type, startedAt = 0) {
  const config = FRUIT_CATALOG[type] || FRUIT_CATALOG.apple
  const color = config.juice
  const effect = new THREE.Group()
  effect.name = 'juice-effect'
  effect.position.set(position.x, position.y, 0)
  effect.userData = { kind: 'juice', type: config.type, startedAt, expiresAt: startedAt + 5 }

  const stainMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.58, depthWrite: false })
  const stain = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), stainMaterial)
  stain.name = 'juice-stain'
  const boardPoint = clampToBoard(position)
  stain.position.set(boardPoint.x - position.x, boardPoint.y - position.y, -1.01)
  stain.scale.set(1.45, 0.72, 1)
  effect.add(stain)

  const droplets = new THREE.Group()
  droplets.name = 'juice-droplets'
  for (let i = 0; i < 30; i += 1) {
    const drop = new THREE.Mesh(
      new THREE.SphereGeometry(0.018 + (i % 4) * 0.008, 7, 6),
      material(color, { roughness: 0.28, transparent: true, opacity: 0.92 }),
    )
    drop.position.set(Math.cos(i * 2.4) * 0.045, Math.sin(i * 1.7) * 0.04, 0.12 + (i % 3) * 0.018)
    drop.scale.set(0.75, 1.2 + (i % 3) * 0.38, 0.75)
    drop.userData.velocity = particleVelocity(i, 1.15 + (i % 5) * 0.16)
    droplets.add(drop)
  }
  effect.add(droplets)

  const spray = new THREE.Group()
  spray.name = 'juice-spray'
  for (let i = 0; i < 9; i += 1) {
    const streak = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.014, 0.12 + (i % 3) * 0.04, 3, 6),
      material(color, { roughness: 0.3, transparent: true, opacity: 0.82 }),
    )
    const angle = (i / 9) * Math.PI * 2
    streak.rotation.z = -angle
    streak.position.z = 0.1
    streak.userData.velocity = particleVelocity(i + 31, 1.35 + (i % 3) * 0.18)
    spray.add(streak)
  }
  effect.add(spray)

  const halves = new THREE.Group()
  halves.name = 'sliced-halves'
  ;[-1, 1].forEach((direction) => halves.add(createSlicedHalf(config.type, direction)))
  effect.add(halves)
  return effect
}

export function createExplosionEffect(position, startedAt = 0) {
  const effect = new THREE.Group()
  effect.name = 'explosion-effect'
  effect.position.copy(position)
  effect.userData = { kind: 'explosion', startedAt, expiresAt: startedAt + 1.35 }

  const flash = new THREE.PointLight(0xff6a1c, 16, 7, 2)
  flash.name = 'explosion-light'
  effect.add(flash)

  const sparks = new THREE.Group()
  sparks.name = 'explosion-sparks'
  for (let i = 0; i < 28; i += 1) {
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), new THREE.MeshBasicMaterial({ color: i % 3 ? 0xff8a22 : 0xffe078 }))
    spark.userData.velocity = particleVelocity(i, 2.1 + (i % 4) * 0.28)
    sparks.add(spark)
  }
  effect.add(sparks)

  const smoke = new THREE.Group()
  smoke.name = 'explosion-smoke'
  for (let i = 0; i < 9; i += 1) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13 + (i % 3) * 0.04, 1), new THREE.MeshStandardMaterial({ color: 0x30343b, roughness: 1, transparent: true, opacity: 0.82 }))
    puff.position.set(Math.cos(i * 2.4) * 0.08, Math.sin(i * 1.7) * 0.08, (i % 3) * 0.025)
    puff.userData.velocity = particleVelocity(i, 0.18)
    smoke.add(puff)
  }
  effect.add(smoke)
  return effect
}

export function updateEffect(effect, now, delta) {
  const age = now - effect.userData.startedAt
  if (now >= effect.userData.expiresAt) return false

  const gravity = effect.userData.kind === 'explosion' ? 1.5 : 1.1
  effect.traverse((child) => {
    if (!child.userData.velocity) return
    child.position.addScaledVector(child.userData.velocity, delta)
    child.userData.velocity.y -= gravity * delta
  })

  if (effect.userData.kind === 'juice') {
    const stain = effect.getObjectByName('juice-stain')
    if (age > 4) stain.material.opacity = Math.max(0, 0.58 * (5 - age))
    const halves = effect.getObjectByName('sliced-halves')
    halves.children.forEach((half) => {
      if (half.userData.keepShape) return
      half.rotation.x += half.userData.spin.x * delta
      half.rotation.y += half.userData.spin.y * delta
      half.rotation.z += half.userData.spin.z * delta
    })
    const airborneOpacity = Math.max(0, 1 - Math.max(0, age - 0.45) / 0.65)
    ;['juice-droplets', 'juice-spray'].forEach((name) => {
      const group = effect.getObjectByName(name)
      group.children.forEach((child) => { child.material.opacity = airborneOpacity })
      if (age > 1.1) group.visible = false
    })
    if (age > 1.65) halves.visible = false
  } else {
    const light = effect.getObjectByName('explosion-light')
    light.intensity = Math.max(0, 16 * (1 - age / 1.35))
    const smoke = effect.getObjectByName('explosion-smoke')
    smoke.children.forEach((puff) => {
      puff.scale.addScalar(delta * 0.85)
      puff.material.opacity = Math.max(0, 0.82 * (1 - age / 1.35))
    })
  }
  return true
}
