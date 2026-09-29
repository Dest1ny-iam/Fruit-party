import * as THREE from 'three'
import { FRUIT_CATALOG } from './fruitCatalog'

const skin = (color, roughness = 0.58, metalness = 0) => new THREE.MeshStandardMaterial({
  color,
  roughness,
  metalness,
})

function mesh(geometry, material, name = '') {
  const object = new THREE.Mesh(geometry, material)
  object.name = name
  object.castShadow = true
  object.receiveShadow = true
  return object
}

function leaf(color = 0x3d7d35, length = 0.55) {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.quadraticCurveTo(length * 0.5, length * 0.2, length, 0)
  shape.quadraticCurveTo(length * 0.5, -length * 0.2, 0, 0)
  const result = mesh(new THREE.ShapeGeometry(shape, 5), skin(color, 0.72))
  result.material.side = THREE.DoubleSide
  // 叶片只是外观细节，不参与投影，避免菜板上出现锯齿状黑影。
  result.castShadow = false
  result.receiveShadow = false
  return result
}

function dragonBract(color = 0x5e9b3d) {
  // 火龙果的“叶片”是贴在果皮上的柔软苞片，不是向外伸出的圆锥刺。
  const shape = new THREE.Shape()
  shape.moveTo(0, -0.17)
  shape.quadraticCurveTo(0.12, -0.08, 0.16, 0.11)
  shape.quadraticCurveTo(0.03, 0.07, -0.11, 0.18)
  shape.quadraticCurveTo(-0.04, 0.02, 0, -0.17)
  const bract = mesh(new THREE.ShapeGeometry(shape, 4), skin(color, 0.82), 'dragonfruit-bract')
  bract.material.side = THREE.DoubleSide
  bract.castShadow = false
  bract.receiveShadow = false
  return bract
}

function makeApple(group) {
  const red = skin(0xc91f35, 0.42)
  const body = mesh(new THREE.SphereGeometry(0.58, 28, 22), red, 'apple-body')
  body.scale.set(1, 0.9, 0.96)
  group.add(body)
  ;[-0.2, 0.2].forEach((x) => {
    const lobe = mesh(new THREE.SphereGeometry(0.39, 22, 18), red)
    lobe.position.set(x, 0.12, 0)
    lobe.scale.set(0.82, 0.72, 0.86)
    group.add(lobe)
  })
  const stem = mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.35, 10), skin(0x54351d, 0.88), 'apple-stem')
  stem.position.y = 0.62
  stem.rotation.z = -0.15
  group.add(stem)
  const appleLeaf = leaf(0x4d8e3d, 0.48)
  appleLeaf.position.set(0.02, 0.66, 0.02)
  appleLeaf.rotation.set(-0.55, 0.25, -0.15)
  group.add(appleLeaf)
}

function makeOrange(group) {
  const body = mesh(new THREE.IcosahedronGeometry(0.58, 4), skin(0xef7f18, 0.7), 'orange-body')
  const positions = body.geometry.attributes.position
  for (let i = 0; i < positions.count; i += 1) {
    const v = new THREE.Vector3().fromBufferAttribute(positions, i)
    v.multiplyScalar(1 + Math.sin(i * 12.9898) * 0.008)
    positions.setXYZ(i, v.x, v.y, v.z)
  }
  body.geometry.computeVertexNormals()
  group.add(body)
  const crown = mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.045, 10), skin(0x477834, 0.82), 'orange-crown')
  crown.position.y = 0.58
  group.add(crown)
}

function makeWatermelon(group) {
  // 西瓜主体沿横轴略扁长，避免被做成普通的圆球。
  const shell = mesh(new THREE.SphereGeometry(0.68, 48, 32), skin(0x4b9b4f, 0.72), 'watermelon-shell')
  shell.scale.set(1.25, 0.84, 0.88)
  group.add(shell)
  const stripeMaterial = skin(0x174f32, 0.86)
  const lightStripeMaterial = skin(0x75a855, 0.84)
  for (let stripe = 0; stripe < 12; stripe += 1) {
    const angle = (stripe / 12) * Math.PI * 2
    const points = []
    for (let step = 0; step <= 18; step += 1) {
      const x = -0.82 + (step / 18) * 1.64
      const radius = Math.sqrt(Math.max(0.03, 1 - (x / 0.82) ** 2))
      const wobble = Math.sin(step * 1.45 + stripe * 0.7) * 0.008
      points.push(new THREE.Vector3(
        x,
        Math.cos(angle) * (0.565 * radius + wobble),
        Math.sin(angle) * (0.59 * radius + wobble),
      ))
    }
    const curve = new THREE.CatmullRomCurve3(points)
    const stripeMesh = mesh(
      new THREE.TubeGeometry(curve, 44, stripe % 3 === 0 ? 0.018 : 0.012, 5, false),
      stripe % 3 === 0 ? stripeMaterial : lightStripeMaterial,
      `watermelon-stripe-${stripe}`,
    )
    // 条纹贴皮显示即可，不让每条纹都在木板上投影。
    stripeMesh.castShadow = false
    stripeMesh.receiveShadow = false
    group.add(stripeMesh)
  }
  const stem = mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.18, 8), skin(0x4b6130, 0.9), 'watermelon-stem')
  stem.position.x = 0.84
  stem.rotation.z = Math.PI / 2
  group.add(stem)
}

function makeCantaloupe(group) {
  // 哈密瓜的轮廓比西瓜更接近饱满椭球，表面由浅黄绿色皮与细网纹构成。
  const body = mesh(new THREE.SphereGeometry(0.66, 40, 28), skin(0xc6b95a, 0.82), 'cantaloupe-body')
  body.scale.set(1.14, 0.86, 0.96)
  group.add(body)

  const netMaterial = skin(0x8b7c37, 0.92)
  // 两组经纬曲线只做视觉网纹，不投影，避免它们把菜板阴影切得过碎。
  for (let ring = 1; ring < 7; ring += 1) {
    const y = -0.48 + ring * 0.16
    const radius = 0.62 * Math.sqrt(Math.max(0.16, 1 - (y / 0.66) ** 2))
    const points = []
    for (let step = 0; step <= 30; step += 1) {
      const angle = (step / 30) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(angle) * radius * 1.14, y * 0.86, Math.sin(angle) * radius * 0.96))
    }
    const seam = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 36, 0.008, 4, true), netMaterial, `cantaloupe-net-ring-${ring}`)
    seam.castShadow = false
    seam.receiveShadow = false
    group.add(seam)
  }
  for (let line = 0; line < 10; line += 1) {
    const angle = (line / 10) * Math.PI * 2
    const points = []
    for (let step = 0; step <= 18; step += 1) {
      const latitude = -Math.PI / 2 + (step / 18) * Math.PI
      points.push(new THREE.Vector3(
        Math.cos(angle) * Math.cos(latitude) * 0.66 * 1.14,
        Math.sin(latitude) * 0.66 * 0.86,
        Math.sin(angle) * Math.cos(latitude) * 0.66 * 0.96,
      ))
    }
    const seam = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 28, 0.007, 4, false), netMaterial, `cantaloupe-net-line-${line}`)
    seam.castShadow = false
    seam.receiveShadow = false
    group.add(seam)
  }
  const stem = mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.18, 8), skin(0x516a32, 0.88), 'cantaloupe-stem')
  stem.position.y = 0.59
  stem.rotation.z = -0.12
  group.add(stem)
}

function makePear(group) {
  // LatheGeometry 的轮廓让梨呈现下宽上窄的真实外形，而不是简单拉长的圆球。
  const profile = [
    new THREE.Vector2(0, -0.68),
    new THREE.Vector2(0.18, -0.65),
    new THREE.Vector2(0.47, -0.4),
    new THREE.Vector2(0.51, -0.04),
    new THREE.Vector2(0.37, 0.25),
    new THREE.Vector2(0.2, 0.46),
    new THREE.Vector2(0.15, 0.61),
    new THREE.Vector2(0.07, 0.66),
  ]
  group.add(mesh(new THREE.LatheGeometry(profile, 36), skin(0x9db841, 0.6), 'pear-body'))
  const blush = mesh(new THREE.SphereGeometry(0.19, 16, 12), skin(0xd0a948, 0.62), 'pear-blush')
  blush.position.set(0.34, -0.12, 0.32)
  blush.scale.set(1, 1.45, 0.16)
  blush.castShadow = false
  blush.receiveShadow = false
  group.add(blush)
  const stem = mesh(new THREE.CylinderGeometry(0.028, 0.043, 0.34, 8), skin(0x57371e, 0.9), 'pear-stem')
  stem.position.y = 0.75
  stem.rotation.z = -0.2
  group.add(stem)
  const pearLeaf = leaf(0x477e34, 0.48)
  pearLeaf.position.set(0.06, 0.78, 0.02)
  pearLeaf.rotation.set(-0.72, 0.28, -0.3)
  group.add(pearLeaf)
}

function makeBanana(group) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.72, 0.26, 0),
    new THREE.Vector3(-0.36, -0.12, 0),
    new THREE.Vector3(0.08, -0.25, 0),
    new THREE.Vector3(0.55, -0.06, 0),
    new THREE.Vector3(0.76, 0.28, 0),
  ])
  const body = mesh(new THREE.TubeGeometry(curve, 44, 0.2, 9, false), skin(0xf2c62e, 0.58), 'banana-body')
  body.scale.z = 0.78
  group.add(body)
  const endMaterial = skin(0x755523, 0.86)
  ;[[-0.76, 0.32, -0.38], [0.8, 0.34, 0.35]].forEach(([x, y, angle]) => {
    const end = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 8), endMaterial)
    end.position.set(x, y, 0)
    end.rotation.z = angle
    group.add(end)
  })
}

function makePineapple(group) {
  const body = mesh(new THREE.SphereGeometry(0.55, 24, 20), skin(0xd19a2d, 0.82), 'pineapple-body')
  body.scale.set(0.82, 1.16, 0.82)
  group.add(body)
  const scaleMaterial = skin(0x8a641d, 0.86)
  for (let row = 0; row < 6; row += 1) {
    const y = -0.46 + row * 0.18
    const radius = 0.43 * Math.sqrt(Math.max(0.25, 1 - (y / 0.66) ** 2))
    for (let column = 0; column < 8; column += 1) {
      const angle = (column / 8) * Math.PI * 2 + (row % 2) * 0.38
      const scale = mesh(new THREE.OctahedronGeometry(0.09, 0), scaleMaterial)
      scale.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
      scale.scale.set(1, 0.72, 0.45)
      scale.lookAt(0, y, 0)
      group.add(scale)
    }
  }
  for (let i = 0; i < 9; i += 1) {
    const crownLeaf = mesh(new THREE.ConeGeometry(0.09, 0.72, 5), skin(i % 2 ? 0x377a3f : 0x4b984b, 0.75), `pineapple-leaf-${i}`)
    const angle = (i / 9) * Math.PI * 2
    crownLeaf.position.set(Math.cos(angle) * 0.14, 0.88, Math.sin(angle) * 0.14)
    crownLeaf.rotation.z = Math.cos(angle) * 0.38
    crownLeaf.rotation.x = Math.sin(angle) * 0.38
    group.add(crownLeaf)
  }
}

function makeKiwi(group) {
  const body = mesh(new THREE.SphereGeometry(0.54, 24, 18), skin(0x7a4e2c, 0.96), 'kiwi-body')
  body.scale.set(0.84, 1.12, 0.84)
  group.add(body)
  const fuzzMaterial = skin(0x3f281b, 1)
  for (let i = 0; i < 24; i += 1) {
    const angle = i * 2.399
    const y = -0.48 + (i / 23) * 0.96
    const radius = 0.44 * Math.sqrt(Math.max(0.1, 1 - (y / 0.58) ** 2))
    const fuzz = mesh(new THREE.ConeGeometry(0.008, 0.07, 4), fuzzMaterial)
    fuzz.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    fuzz.lookAt(fuzz.position.clone().multiplyScalar(1.4))
    group.add(fuzz)
  }
}

function makeStrawberry(group) {
  const profile = [
    new THREE.Vector2(0, -0.62), new THREE.Vector2(0.32, -0.32),
    new THREE.Vector2(0.48, 0.14), new THREE.Vector2(0.38, 0.5), new THREE.Vector2(0.08, 0.58),
  ]
  group.add(mesh(new THREE.LatheGeometry(profile, 28), skin(0xd9253e, 0.48), 'strawberry-body'))
  const seedMaterial = skin(0xffd36a, 0.7)
  for (let i = 0; i < 22; i += 1) {
    const angle = i * 2.4
    const y = -0.35 + (i % 7) * 0.12
    const radius = 0.39 * Math.sqrt(Math.max(0.18, 1 - (y / 0.65) ** 2))
    const seed = mesh(new THREE.SphereGeometry(0.025, 6, 5), seedMaterial)
    seed.scale.set(0.62, 1.35, 0.45)
    seed.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    group.add(seed)
  }
  for (let i = 0; i < 6; i += 1) {
    const calyx = leaf(0x3e8f3d, 0.38)
    calyx.position.y = 0.56
    calyx.rotation.set(-Math.PI / 2, 0, (i / 6) * Math.PI * 2)
    group.add(calyx)
  }
}

function makeDragonfruit(group) {
  const profile = [
    new THREE.Vector2(0, -0.62),
    new THREE.Vector2(0.27, -0.59),
    new THREE.Vector2(0.48, -0.38),
    new THREE.Vector2(0.56, -0.08),
    new THREE.Vector2(0.53, 0.23),
    new THREE.Vector2(0.38, 0.48),
    new THREE.Vector2(0.16, 0.61),
    new THREE.Vector2(0, 0.63),
  ]
  const body = mesh(new THREE.LatheGeometry(profile, 40), skin(0xe94586, 0.62), 'dragonfruit-body')
  group.add(body)
  const layers = [-0.3, 0.02, 0.31]
  let bractIndex = 0
  layers.forEach((y, layer) => {
    const count = 4
    const bodyRadius = 0.47 * Math.sqrt(Math.max(0.12, 1 - (y / 0.64) ** 2))
    for (let index = 0; index < count; index += 1) {
      const angle = ((index + (layer % 2) * 0.5) / count) * Math.PI * 2
      const normal = new THREE.Vector3(
        Math.cos(angle) * bodyRadius,
        y / 0.64,
        Math.sin(angle) * bodyRadius,
      ).normalize()
      const bract = dragonBract(index % 2 ? 0x4f8b36 : 0x6aa840)
      bract.position.set(Math.cos(angle) * bodyRadius, y, Math.sin(angle) * bodyRadius)
      bract.position.addScaledVector(normal, 0.024)
      bract.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
      bract.rotateZ(-0.38 + (index % 2) * 0.15)
      bract.scale.setScalar(0.76 + layer * 0.04)
      bract.name = `dragonfruit-bract-${bractIndex}`
      bractIndex += 1
      group.add(bract)
    }
  })
}

const builders = {
  apple: makeApple,
  orange: makeOrange,
  watermelon: makeWatermelon,
  cantaloupe: makeCantaloupe,
  banana: makeBanana,
  pineapple: makePineapple,
  kiwi: makeKiwi,
  strawberry: makeStrawberry,
  dragonfruit: makeDragonfruit,
  pear: makePear,
}

function normalize(group, targetSize) {
  group.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(group)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const factor = targetSize / Math.max(size.x, size.y, size.z)
  group.children.forEach((child) => child.position.sub(center))
  group.scale.setScalar(factor)
  group.updateMatrixWorld(true)
}

export function createFruitModel(type) {
  const config = FRUIT_CATALOG[type] || FRUIT_CATALOG.apple
  const group = new THREE.Group()
  group.name = `fruit-${config.type}`
  group.userData = { kind: 'fruit', type: config.type, score: config.score }
  builders[config.type](group)
  normalize(group, config.scale)
  return group
}

export function createBombModel() {
  const group = new THREE.Group()
  group.name = 'bomb'
  group.userData = { kind: 'bomb', type: 'bomb' }
  group.add(mesh(new THREE.SphereGeometry(0.48, 28, 22), skin(0x171b22, 0.28, 0.72), 'bomb-body'))
  const cap = mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.2, 12), skin(0x6f5d3f, 0.42, 0.55), 'bomb-cap')
  cap.position.y = 0.48
  group.add(cap)
  const fuseCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.57, 0), new THREE.Vector3(0.1, 0.75, 0), new THREE.Vector3(0.24, 0.83, 0)])
  group.add(mesh(new THREE.TubeGeometry(fuseCurve, 16, 0.025, 6), skin(0x5a3a25, 0.95), 'bomb-fuse'))
  const ember = mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff6b1a, emissive: 0xff3b00, emissiveIntensity: 3 }), 'bomb-ember')
  ember.position.set(0.25, 0.84, 0)
  group.add(ember)
  normalize(group, 0.78)
  return group
}
