// STL convention: X is left/right, Y is depth, Z is vertical; dimensions are
// the source model units (approximately millimetres). Textured-model anchors
// use the OBJ's own coordinates (Y up, positive Z toward the viewer) and map
// the clear inner aperture of each frame.
export const ALTAR_STL_BOUNDS = {
  minX: -120.278244,
  maxX: 120.132721,
  minY: -84.565140,
  maxY: 84.710999,
  minZ: 0,
  maxZ: 236.300018
};

export const ALTAR_PHOTO_FRAMES = [
  {
    id: 'left',
    position: { x: -38, y: 20.5, z: 136 },
    aperture: { width: 10, height: 13 },
    texturedPosition: { x: -.333, y: .121, z: -.212 },
    texturedAperture: { width: .155, height: .214 },
    texturedTiltX: -.43
  },
  {
    id: 'center',
    position: { x: 0, y: 13.7, z: 136 },
    aperture: { width: 22, height: 23 },
    texturedPosition: { x: 0, y: .183, z: -.17 },
    texturedAperture: { width: .26, height: .3103 },
    texturedTiltX: -.39
  },
  {
    id: 'right',
    position: { x: 38, y: 22, z: 136 },
    aperture: { width: 10, height: 13 },
    texturedPosition: { x: .288, y: .135, z: -.224 },
    texturedAperture: { width: .16, height: .172 },
    texturedTiltX: -.4
  }
];

export const ALTAR_FEATURE_MAP = {
  coordinateNote: 'Approximate X/Z centres from the colored front reference; Y varies with each object depth.',
  candles: [
    { x: -27, z: 148, group: 'upper shelf' },
    { x: 27, z: 148, group: 'upper shelf' },
    { x: -28, z: 107, group: 'middle shelf' },
    { x: 28, z: 107, group: 'middle shelf' }
  ],
  sugarSkulls: [
    { x: 0, z: 220, group: 'crown' },
    { x: -39, z: 134, group: 'upper shelf' },
    { x: 39, z: 134, group: 'upper shelf' },
    { x: -44, z: 73, group: 'lower shelf' },
    { x: 31, z: 91, group: 'lower shelf' }
  ],
  papelPicado: [
    { x: -30, z: 184, color: '#6d20c5' },
    { x: 0, z: 184, color: '#f27b18' },
    { x: 30, z: 184, color: '#df2675' }
  ],
  planters: [
    { x: -68, z: 127, group: 'upper shelf' },
    { x: -50, z: 123, group: 'upper shelf' },
    { x: 52, z: 123, group: 'upper shelf' },
    { x: 77, z: 127, group: 'upper shelf' },
    { x: -83, z: 85, group: 'lower shelf' },
    { x: 84, z: 85, group: 'lower shelf' }
  ],
  cempasuchilClusters: [
    { x: -53, z: 215 }, { x: -36, z: 220 }, { x: -22, z: 225 },
    { x: 20, z: 224 }, { x: 37, z: 218 }, { x: 54, z: 212 },
    { x: -79, z: 190 }, { x: 81, z: 187 },
    { x: -85, z: 153 }, { x: 85, z: 152 },
    { x: -35, z: 134 }, { x: -18, z: 132 }, { x: 0, z: 130 },
    { x: 18, z: 132 }, { x: 37, z: 133 },
    { x: -84, z: 103 }, { x: 85, z: 103 },
    { x: -75, z: 87 }, { x: 75, z: 87 },
    { x: -51, z: 65 }, { x: -26, z: 64 }, { x: 28, z: 63 },
    { x: 51, z: 62 }, { x: -38, z: 45 }, { x: 38, z: 45 }
  ],
  panDeMuerto: { x: 0, z: 97, group: 'middle shelf' },
  statues: [
    { x: -78, z: 151, group: 'left niche' },
    { x: 78, z: 151, group: 'right niche' }
  ]
};
