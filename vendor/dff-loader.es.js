import * as m from "three";
const A = {
  // Core chunks
  CHUNK_NAOBJECT: 0,
  CHUNK_STRUCT: 1,
  CHUNK_STRING: 2,
  CHUNK_EXTENSION: 3,
  CHUNK_CAMERA: 5,
  CHUNK_TEXTURE: 6,
  CHUNK_MATERIAL: 7,
  CHUNK_MATERIALLIST: 8,
  CHUNK_ATOMICSECT: 9,
  CHUNK_PLANESECT: 10,
  CHUNK_WORLD: 11,
  CHUNK_SPLINE: 12,
  CHUNK_MATRIX: 13,
  CHUNK_FRAMELIST: 14,
  CHUNK_GEOMETRY: 15,
  CHUNK_CLUMP: 16,
  CHUNK_LIGHT: 18,
  CHUNK_UNICODESTRING: 19,
  CHUNK_ATOMIC: 20,
  CHUNK_TEXTURENATIVE: 21,
  CHUNK_TEXDICTIONARY: 22,
  CHUNK_ANIMDATABASE: 23,
  CHUNK_IMAGE: 24,
  CHUNK_SKINANIMATION: 25,
  CHUNK_GEOMETRYLIST: 26,
  CHUNK_ANIMANIMATION: 27,
  CHUNK_HANIMANIMATION: 27,
  CHUNK_TEAM: 28,
  CHUNK_CROWD: 29,
  CHUNK_RIGHTTORENDER: 31,
  CHUNK_MTEFFECTNATIVE: 32,
  CHUNK_MTEFFECTDICT: 33,
  CHUNK_TEAMDICTIONARY: 34,
  CHUNK_PITEXDICTIONARY: 35,
  CHUNK_TOC: 36,
  CHUNK_PRTSTDGLOBALDATA: 37,
  CHUNK_ALTPIPE: 38,
  CHUNK_PIPEDS: 39,
  CHUNK_PATCHMESH: 40,
  CHUNK_CHUNKGROUPSTART: 41,
  CHUNK_CHUNKGROUPEND: 42,
  CHUNK_UVANIMDICT: 43,
  CHUNK_COLLTREE: 44,
  CHUNK_ENVIRONMENT: 45,
  CHUNK_COREPLUGINIDMAX: 46,
  // Plugin chunks
  CHUNK_MORPH: 261,
  CHUNK_SKYMIPMAP: 272,
  CHUNK_SKIN: 278,
  CHUNK_PARTICLES: 280,
  CHUNK_HANIM: 286,
  CHUNK_MATERIALEFFECTS: 288,
  CHUNK_PDSPLG: 305,
  CHUNK_ADCPLG: 308,
  CHUNK_UVANIMPLG: 309,
  CHUNK_BINMESH: 1294,
  CHUNK_NATIVEDATA: 1296,
  CHUNK_VERTEXFORMAT: 1296,
  // Rockstar custom chunks (GTA series)
  CHUNK_PIPELINESET: 39056115,
  CHUNK_SPECULARMAT: 39056118,
  CHUNK_2DFX: 39056120,
  CHUNK_NIGHTVERTEXCOLOR: 39056121,
  CHUNK_COLLISIONMODEL: 39056122,
  CHUNK_REFLECTIONMAT: 39056124,
  CHUNK_MESHEXTENSION: 39056125,
  CHUNK_FRAME: 39056126
}, K = {
  rwTEXTURED: 4,
  rwPRELIT: 8,
  rwTEXTURED2: 128,
  rwNATIVE: 16777216
};
class y {
  constructor() {
    this.data = null, this.position = 0;
  }
  parse(s) {
    for (this.data = new DataView(s), this.position = 0; this.position < s.byteLength; ) {
      const t = this.readChunk(A.CHUNK_CLUMP);
      if (t) return t;
    }
    return null;
  }
  readHeader(s) {
    const t = {
      type: this.readUInt32(),
      length: 0,
      build: 0,
      version: 0
    };
    return t.name = this.getChunkName(t.type), t.length = this.readUInt32(), t.build = this.readUInt32(), t.build & 4294901760 ? t.version = t.build >> 14 & 261888 | t.build >> 16 & 63 | 196608 : t.version = t.build << 8, s !== void 0 && (t.parent = s), t;
  }
  getChunkName(s) {
    for (const t in A)
      if (A[t] === s) return t;
    return "CHUNK_UNKNOWN";
  }
  checkBounds(s) {
    if (this.position + s > this.data.byteLength)
      throw new Error(`DFFLoader: Buffer overflow at position ${this.position} (need ${s} bytes, have ${this.data.byteLength - this.position})`);
  }
  readInt32() {
    this.checkBounds(4);
    const s = this.data.getInt32(this.position, !0);
    return this.position += 4, s;
  }
  readUInt32() {
    this.checkBounds(4);
    const s = this.data.getUint32(this.position, !0);
    return this.position += 4, s;
  }
  readUInt16() {
    this.checkBounds(2);
    const s = this.data.getUint16(this.position, !0);
    return this.position += 2, s;
  }
  readUInt8() {
    this.checkBounds(1);
    const s = this.data.getUint8(this.position);
    return this.position += 1, s;
  }
  readFloat32() {
    this.checkBounds(4);
    const s = this.data.getFloat32(this.position, !0);
    return this.position += 4, s;
  }
  readString(s) {
    let t = "";
    const a = this.position + s;
    for (; this.position < a; ) {
      const r = this.data.getUint8(this.position++);
      if (r === 0) {
        this.position = a;
        break;
      }
      t += String.fromCharCode(r);
    }
    return t.trim();
  }
  readChunk(s, t) {
    const a = this.position, r = this.readHeader(t);
    if (s !== r.type)
      return s !== A.CHUNK_CLUMP && console.error(`DFFLoader: Chunk "${this.getChunkName(s)}" not found at position ${a}`), this.position += r.length, null;
    const o = this.position, i = this.readData(r);
    if (this.position < o + r.length)
      console.warn(`DFFLoader: Chunk ${r.name} not read to end`), this.position = o + r.length;
    else if (this.position > o + r.length)
      throw new Error(`DFFLoader: Offset is outside the bounds of chunk ${r.name}`);
    return i;
  }
  readData(s) {
    let t = null;
    switch (s.type) {
      case A.CHUNK_CLUMP: {
        const a = this.readHeader(), r = this.readUInt32();
        a.length === 12 && (this.readUInt32(), this.readUInt32()), t = {
          RWFrameList: this.readChunk(A.CHUNK_FRAMELIST),
          RWGeometryList: this.readChunk(A.CHUNK_GEOMETRYLIST),
          RWAtomicList: []
        };
        for (let o = 0; o < r; o++)
          t.RWAtomicList[o] = this.readChunk(A.CHUNK_ATOMIC);
        this.readExtension(t);
        break;
      }
      case A.CHUNK_FRAMELIST: {
        this.readHeader();
        const a = this.readUInt32();
        t = new Array(a);
        for (let r = 0; r < a; r++) {
          const o = {
            rotationMatrix: [
              this.readFloat32(),
              this.readFloat32(),
              this.readFloat32(),
              this.readFloat32(),
              this.readFloat32(),
              this.readFloat32(),
              this.readFloat32(),
              this.readFloat32(),
              this.readFloat32()
            ],
            position: [this.readFloat32(), this.readFloat32(), this.readFloat32()],
            parentIndex: this.readInt32(),
            flags: this.readUInt32()
          };
          t[r] = { RWFrame: o };
        }
        for (let r = 0; r < a; r++)
          this.readExtension(t[r]);
        break;
      }
      case A.CHUNK_GEOMETRYLIST: {
        this.readHeader();
        const a = this.readUInt32();
        t = new Array(a);
        for (let r = 0; r < a; r++)
          t[r] = this.readChunk(A.CHUNK_GEOMETRY);
        break;
      }
      case A.CHUNK_GEOMETRY: {
        const a = this.readHeader();
        this.position, t = {
          format: this.readUInt32(),
          numTriangles: this.readUInt32(),
          numVertices: this.readUInt32(),
          numMorphTargets: this.readUInt32()
        };
        let r = t.format >> 16 & 255;
        r === 0 && t.format & K.rwTEXTURED && (r = 1), console.log(`DFFLoader: Geometry - format: 0x${t.format.toString(16)}, verts: ${t.numVertices}, tris: ${t.numTriangles}, morphs: ${t.numMorphTargets}, UVs: ${r}`), console.log(`DFFLoader: Flags - native: ${!!(t.format & K.rwNATIVE)}, prelit: ${!!(t.format & K.rwPRELIT)}, textured: ${!!(t.format & K.rwTEXTURED)}, textured2: ${!!(t.format & K.rwTEXTURED2)}`), a.version < 212992 && (t.ambient = this.readFloat32(), t.specular = this.readFloat32(), t.diffuse = this.readFloat32());
        const o = (t.format & K.rwNATIVE) !== 0;
        if (!o) {
          if (t.format & K.rwPRELIT) {
            t.prelitcolor = new Array(t.numVertices);
            for (let e = 0; e < t.numVertices; e++)
              t.prelitcolor[e] = {
                r: this.readUInt8(),
                g: this.readUInt8(),
                b: this.readUInt8(),
                a: this.readUInt8()
              };
            console.log(`DFFLoader: Read ${t.numVertices} vertex colors`);
          }
          if (t.format & (K.rwTEXTURED | K.rwTEXTURED2)) {
            t.texCoords = new Array(r);
            for (let e = 0; e < r; e++) {
              t.texCoords[e] = new Array(t.numVertices);
              for (let n = 0; n < t.numVertices; n++)
                t.texCoords[e][n] = {
                  u: this.readFloat32(),
                  v: this.readFloat32()
                };
            }
            console.log(`DFFLoader: Read ${r} UV sets`);
          }
          t.triangles = new Array(t.numTriangles);
          const i = /* @__PURE__ */ new Set();
          for (let e = 0; e < t.numTriangles; e++) {
            const n = this.readUInt16(), x = this.readUInt16(), f = this.readUInt16(), U = this.readUInt16();
            e < 5 && console.log("Triangle " + e + " raw: [" + n + ", " + x + ", " + f + ", " + U + "]"), t.triangles[e] = {
              vertex2: n,
              vertex1: x,
              materialId: f,
              vertex3: U
            }, i.add(t.triangles[e].materialId);
          }
          console.log("DFFLoader: Read " + t.numTriangles + " triangles, unique materialIds:", [...i]);
        }
        t.morphTargets = new Array(t.numMorphTargets);
        for (let i = 0; i < t.numMorphTargets; i++)
          if (t.morphTargets[i] = {
            boundingSphere: {
              x: this.readFloat32(),
              y: this.readFloat32(),
              z: this.readFloat32(),
              radius: this.readFloat32()
            },
            hasVertices: 0,
            hasNormals: 0
          }, !o) {
            if (t.morphTargets[i].hasVertices = this.readUInt32(), t.morphTargets[i].hasNormals = this.readUInt32(), t.morphTargets[i].hasVertices) {
              t.morphTargets[i].vertices = new Array(t.numVertices);
              for (let e = 0; e < t.numVertices; e++)
                t.morphTargets[i].vertices[e] = {
                  x: this.readFloat32(),
                  y: this.readFloat32(),
                  z: this.readFloat32()
                };
            }
            if (t.morphTargets[i].hasNormals) {
              t.morphTargets[i].normals = new Array(t.numVertices);
              for (let e = 0; e < t.numVertices; e++)
                t.morphTargets[i].normals[e] = {
                  x: this.readFloat32(),
                  y: this.readFloat32(),
                  z: this.readFloat32()
                };
            }
          }
        console.log(`DFFLoader: Read ${t.numMorphTargets} morph targets, position now: ${this.position}`), t.RWMaterialList = this.readChunk(A.CHUNK_MATERIALLIST), this.readExtension(t);
        break;
      }
      case A.CHUNK_MATERIALLIST: {
        this.readHeader();
        const a = this.readUInt32();
        t = new Array(a);
        for (let r = 0; r < a; r++)
          t[r] = { id: this.readUInt32() };
        for (let r = 0; r < a; r++)
          t[r].RWMaterial = this.readChunk(A.CHUNK_MATERIAL);
        break;
      }
      case A.CHUNK_MATERIAL: {
        const a = this.readHeader();
        t = {
          flags: this.readUInt32(),
          color: {
            r: this.readUInt8(),
            g: this.readUInt8(),
            b: this.readUInt8(),
            a: this.readUInt8()
          }
        }, this.readUInt32(), t.isTextured = this.readUInt32(), a.version > 197632 && (t.ambient = this.readFloat32(), t.specular = this.readFloat32(), t.diffuse = this.readFloat32()), t.isTextured && (t.RWTexture = this.readChunk(A.CHUNK_TEXTURE)), this.readExtension(t);
        break;
      }
      case A.CHUNK_TEXTURE: {
        this.readHeader(), t = {
          filterFlags: this.readUInt16()
        }, this.readUInt16(), t.name = this.readChunk(A.CHUNK_STRING), t.maskName = this.readChunk(A.CHUNK_STRING), this.readExtension(t);
        break;
      }
      case A.CHUNK_STRING:
        t = this.readString(s.length);
        break;
      case A.CHUNK_ATOMIC: {
        this.readHeader(), t = {
          frameIndex: this.readUInt32(),
          geometryIndex: this.readUInt32(),
          flags: this.readUInt32()
        }, this.readUInt32(), this.readExtension(t);
        break;
      }
      case A.CHUNK_EXTENSION: {
        t = {};
        const a = this.position + s.length;
        for (; this.position < a; ) {
          const r = this.readHeader();
          let o = {};
          const i = this.position;
          switch (r.type) {
            case A.CHUNK_HANIM:
              if (o = {
                hAnimVersion: this.readUInt32(),
                nodeId: this.readUInt32(),
                numNodes: this.readUInt32()
              }, o.numNodes) {
                o.flags = this.readUInt32(), o.keyFrameSize = this.readUInt32(), o.nodes = new Array(o.numNodes);
                for (let e = 0; e < o.numNodes; e++)
                  o.nodes[e] = {
                    nodeId: this.readUInt32(),
                    nodeIndex: this.readUInt32(),
                    flags: this.readUInt32()
                  };
              }
              break;
            case A.CHUNK_FRAME:
              o = this.readString(r.length);
              break;
            case A.CHUNK_BINMESH: {
              o = {
                faceType: this.readUInt32()
              };
              const e = this.readUInt32();
              o.numIndices = this.readUInt32(), o.splits = new Array(e);
              const n = r.length > 12 + e * 8;
              for (let x = 0; x < e; x++) {
                const f = this.readUInt32();
                if (o.splits[x] = { numIndices: f, matIndex: this.readUInt32() }, n) {
                  o.splits[x].indices = new Array(f);
                  for (let U = 0; U < f; U++)
                    o.splits[x].indices[U] = this.readUInt32();
                }
              }
              break;
            }
            case A.CHUNK_SKIN: {
              o = {
                numBones: this.readUInt8(),
                numUsedBones: this.readUInt8(),
                maxWeightsPerVertex: this.readUInt8(),
                padding: this.readUInt8()
              }, o.bonesUsed = new Array(o.numUsedBones);
              for (let n = 0; n < o.numUsedBones; n++)
                o.bonesUsed[n] = this.readUInt8();
              const e = s.parent.numVertices;
              o.vertexBoneIndices = new Array(e);
              for (let n = 0; n < e; n++)
                o.vertexBoneIndices[n] = {
                  x: this.readUInt8(),
                  y: this.readUInt8(),
                  z: this.readUInt8(),
                  w: this.readUInt8()
                };
              o.vertexBoneWeights = new Array(e);
              for (let n = 0; n < e; n++)
                o.vertexBoneWeights[n] = {
                  x: this.readFloat32(),
                  y: this.readFloat32(),
                  z: this.readFloat32(),
                  w: this.readFloat32()
                };
              o.skinToBoneMatrix = new Array(o.numBones);
              for (let n = 0; n < o.numBones; n++) {
                o.numUsedBones === 0 && (this.position += 4), o.skinToBoneMatrix[n] = [];
                for (let x = 0; x < 16; x++)
                  o.skinToBoneMatrix[n][x] = this.readFloat32();
              }
              o.numUsedBones !== 0 && (this.position += 12);
              break;
            }
            case A.CHUNK_MESHEXTENSION: {
              if (this.readUInt32() === 0) break;
              console.warn("DFFLoader: MESHEXTENSION not fully implemented"), this.position = i + r.length;
              break;
            }
            default:
              this.position += r.length;
              break;
          }
          this.position < i + r.length && (console.warn(`DFFLoader: Extension ${r.name} not read to end`), this.position = i + r.length), t[r.name] && console.warn(`DFFLoader: Duplicate extension ${r.name}`), t[r.name] = o;
        }
        break;
      }
      default:
        console.warn(`DFFLoader: Unknown chunk type ${s.name}`);
        break;
    }
    return t;
  }
  readExtension(s) {
    s.RWExtension = this.readChunk(A.CHUNK_EXTENSION, s);
  }
}
class S extends m.Loader {
  constructor(s) {
    super(s), this.textureDictionary = null;
  }
  /**
   * Set a texture dictionary (Map) loaded from TXD file
   * @param {Map<string, THREE.Texture>} textures - Map of texture name -> THREE.Texture
   */
  setTextureDictionary(s) {
    return this.textureDictionary = s, this;
  }
  load(s, t, a, r) {
    const o = new m.FileLoader(this.manager);
    o.setResponseType("arraybuffer"), o.setPath(this.path), o.setRequestHeader(this.requestHeader), o.setWithCredentials(this.withCredentials), o.load(s, (i) => {
      try {
        t(this.parse(i));
      } catch (e) {
        r ? r(e) : console.error(e), this.manager.itemError(s);
      }
    }, a, r);
  }
  parse(s) {
    const t = new y(), a = new m.Group(), r = t.parse(s);
    if (!r)
      return console.warn("DFFLoader: No clump found in file"), a;
    const o = [];
    return r.RWGeometryList.forEach((i) => {
      var g;
      const e = new m.BufferGeometry(), n = (g = i.RWExtension) == null ? void 0 : g.CHUNK_BINMESH;
      let x = [];
      if (n && n.splits && n.splits.length > 0)
        if (n.splits.some((h) => h.indices && h.indices.length > 0))
          n.splits.forEach((h, u) => {
            if (h.indices && h.indices.length > 0) {
              const F = [];
              if (n.faceType === 0)
                for (let N = 0; N < h.indices.length; N += 3)
                  F.push([
                    h.indices[N],
                    h.indices[N + 1],
                    h.indices[N + 2]
                  ]);
              else
                for (let N = 0; N < h.indices.length - 2; N++)
                  N % 2 === 0 ? F.push([
                    h.indices[N],
                    h.indices[N + 1],
                    h.indices[N + 2]
                  ]) : F.push([
                    h.indices[N + 1],
                    h.indices[N],
                    h.indices[N + 2]
                  ]);
              x.push({
                matIndex: h.matIndex,
                triangles: F
              });
            }
          });
        else {
          let h = 0;
          n.splits.forEach((u, F) => {
            const N = Math.floor((u.numIndices || 0) / 3), I = [];
            for (let _ = 0; _ < N && h + _ < i.triangles.length; _++) {
              const b = i.triangles[h + _];
              I.push([b.vertex1, b.vertex2, b.vertex3]);
            }
            I.length > 0 && x.push({
              matIndex: u.matIndex,
              triangles: I
            }), h += N;
          });
        }
      if (x.length === 0) {
        const R = {};
        i.triangles.forEach((h) => {
          const u = h.materialId || 0;
          R[u] || (R[u] = []), R[u].push([
            h.vertex1,
            h.vertex2,
            h.vertex3
          ]);
        });
        for (const [h, u] of Object.entries(R))
          x.push({
            matIndex: Number(h),
            triangles: u
          });
      }
      const f = x.reduce(
        (R, h) => R + h.triangles.length,
        0
      ), U = new m.BufferAttribute(
        new Float32Array(f * 3 * 3),
        3
      ), p = i.morphTargets[0].hasNormals ? new m.BufferAttribute(new Float32Array(f * 3 * 3), 3) : null, H = !!i.prelitcolor, d = H ? new m.BufferAttribute(new Float32Array(f * 3 * 4), 4) : null, C = i.texCoords ? new m.BufferAttribute(new Float32Array(f * 3 * 2), 2) : null;
      let l = 0;
      const M = {};
      for (const R of x) {
        const h = l;
        for (const u of R.triangles)
          for (const F of u) {
            const N = i.morphTargets[0].vertices[F];
            if (U.setXYZ(l, N.x, N.y, N.z), M[F] = M[F] || [], M[F].push(l), p) {
              const I = i.morphTargets[0].normals[F];
              p.setXYZ(l, I.x, I.y, I.z);
            }
            if (C) {
              const I = i.texCoords[0][F];
              C.setXY(l, I.u, I.v);
            }
            if (d) {
              const I = i.prelitcolor[F];
              d.setXYZW(
                l,
                I.r / 255,
                I.g / 255,
                I.b / 255,
                I.a / 255
              );
            }
            l++;
          }
        e.addGroup(h, l - h, R.matIndex);
      }
      e.setAttribute("position", U), p ? e.setAttribute("normal", p) : e.computeVertexNormals(), d && e.setAttribute("color", d), C && e.setAttribute("uv", C), e.computeBoundingSphere();
      const E = i.RWMaterialList.map((R) => {
        const h = R.RWMaterial, u = new m.MeshStandardMaterial({
          vertexColors: H,
          roughness: h.diffuse !== void 0 ? h.diffuse : 0.8,
          metalness: 0.1,
          color: new m.Color(
            h.color.r / 255,
            h.color.g / 255,
            h.color.b / 255
          ),
          transparent: h.color.a < 255,
          opacity: h.color.a / 255
        });
        if (h.isTextured && h.RWTexture) {
          const F = h.RWTexture.name, N = h.RWTexture.maskName;
          if (console.log(`DFFLoader: Material requests texture "${F}"${N ? ` (mask: ${N})` : ""}`), F && this.textureDictionary) {
            const I = this.textureDictionary.get(F.toLowerCase());
            if (I) {
              const _ = I.texture || I;
              u.map = _.clone(), I.hasAlpha && (u.transparent = !0, u.alphaTest = 0.1), u.map.needsUpdate = !0, console.log(`DFFLoader: Found TXD texture "${F}"`);
            } else
              console.warn(`DFFLoader: Texture "${F}" not found in TXD (available: ${this.textureDictionary.size})`);
          }
          if (!u.map && F) {
            const I = new m.TextureLoader();
            this.path && I.setPath(this.path), u.map = I.load(
              F + ".png",
              () => {
                u.needsUpdate = !0;
              },
              void 0,
              () => {
                u.map = I.load(
                  F + ".jpg",
                  () => {
                    u.needsUpdate = !0;
                  },
                  void 0,
                  () => {
                    u.map = I.load(
                      F + ".bmp",
                      () => {
                        u.needsUpdate = !0;
                      }
                    );
                  }
                );
              }
            );
          }
          if (u.map && (u.map.wrapS = m.RepeatWrapping, u.map.wrapT = m.RepeatWrapping, u.map.colorSpace = m.SRGBColorSpace), N) {
            if (this.textureDictionary) {
              const I = this.textureDictionary.get(N.toLowerCase());
              I && (u.alphaMap = I.clone(), u.alphaMap.needsUpdate = !0);
            }
            if (!u.alphaMap) {
              const I = new m.TextureLoader();
              this.path && I.setPath(this.path), u.alphaMap = I.load(
                N + ".png",
                () => {
                  u.needsUpdate = !0;
                }
              );
            }
            u.alphaMap && (u.alphaMap.wrapS = m.RepeatWrapping, u.alphaMap.wrapT = m.RepeatWrapping, u.transparent = !0, u.alphaTest = 0.05);
          }
        }
        return u;
      });
      if (i.RWExtension && i.RWExtension.CHUNK_SKIN) {
        const R = i.RWExtension.CHUNK_SKIN, h = new m.Float32BufferAttribute(
          new Float32Array(U.count * 4),
          4
        ), u = new m.Float32BufferAttribute(
          new Float32Array(U.count * 4),
          4
        );
        for (let F = 0; F < i.numVertices; F++)
          M[F] && M[F].forEach((N) => {
            const I = R.vertexBoneIndices[F], _ = R.vertexBoneWeights[F];
            h.setXYZW(
              N,
              I.x,
              I.y,
              I.z,
              I.w
            ), u.setXYZW(
              N,
              _.x,
              _.y,
              _.z,
              _.w
            );
          });
        e.setAttribute("skinIndex", h), e.setAttribute("skinWeight", u);
      }
      o.push({ geometry: e, materials: E });
    }), r.RWAtomicList.forEach((i) => {
      const e = o[i.geometryIndex];
      if (!e) return;
      const { geometry: n, materials: x } = e, f = new Array(r.RWFrameList.length);
      let U = null, T = null;
      if (r.RWFrameList.forEach((p, H) => {
        var M, E;
        const d = p.RWFrame, c = new m.Bone();
        c.name = ((M = p.RWExtension) == null ? void 0 : M.CHUNK_FRAME) || `bone_${H}`;
        const C = new m.Matrix4();
        C.set(
          d.rotationMatrix[0],
          d.rotationMatrix[3],
          d.rotationMatrix[6],
          d.position[0],
          d.rotationMatrix[1],
          d.rotationMatrix[4],
          d.rotationMatrix[7],
          d.position[1],
          d.rotationMatrix[2],
          d.rotationMatrix[5],
          d.rotationMatrix[8],
          d.position[2],
          0,
          0,
          0,
          1
        ), c.applyMatrix4(C), d.parentIndex >= 0 && f[d.parentIndex] && f[d.parentIndex].add(c);
        const l = (E = p.RWExtension) == null ? void 0 : E.CHUNK_HANIM;
        l && (c.userData.nodeId = l.nodeId, c.userData.nodeIndex = H, l.numNodes > 0 && (T = c, U = l.nodes.map((g, R) => ({
          id: g.nodeId,
          index: R,
          flags: g.flags,
          frame: null
        })))), f[H] = c;
      }), U) {
        const p = new Array(U.length), H = (c, C, l = /* @__PURE__ */ new Set()) => {
          if (!c || l.has(c)) return null;
          if (l.add(c), c.userData.nodeId >= 0 && c.userData.nodeId === C && d(c) === -1)
            return c;
          for (const E of c.children) {
            const g = H(E, C, l);
            if (g) return g;
          }
          const M = c.userData.nodeIndex + 1;
          return M < f.length ? H(f[M], C, l) : null;
        }, d = (c) => {
          for (let C = 0; C < U.length; C++)
            if (U[C].node === c) return C;
          return -1;
        };
        for (let c = 0; c < U.length; c++)
          U[c].node = H(T, U[c].id), p[c] = U[c].node;
        p.every((c) => c !== null) && (e.skeleton = new m.Skeleton(p));
      }
    }), o.forEach((i) => {
      let e;
      i.skeleton ? (e = new m.SkinnedMesh(i.geometry, i.materials), e.add(i.skeleton.bones[0]), e.bind(i.skeleton)) : e = new m.Mesh(i.geometry, i.materials), e.rotation.set(-Math.PI / 2, 0, Math.PI), a.add(e);
    }), a;
  }
}
const L = {
  FORMAT_1555: 256,
  FORMAT_565: 512,
  FORMAT_4444: 768,
  FORMAT_8888: 1280,
  FORMAT_888: 1536,
  FORMAT_EXT_PAL8: 8192,
  FORMAT_EXT_PAL4: 16384
}, D = {
  D3DFMT_A8R8G8B8: 21,
  D3DFMT_X8R8G8B8: 22,
  D3DFMT_R5G6B5: 23,
  D3DFMT_A1R5G5B5: 25,
  D3DFMT_A4R4G4B4: 26,
  D3DFMT_DXT3: 861165636,
  // 'DXT3'
  D3DFMT_DXT5: 894720068
  // 'DXT5'
};
class B extends m.Loader {
  constructor(s) {
    super(s), this.textures = /* @__PURE__ */ new Map();
  }
  load(s, t, a, r) {
    const o = new m.FileLoader(this.manager);
    o.setResponseType("arraybuffer"), o.setPath(this.path), o.setRequestHeader(this.requestHeader), o.setWithCredentials(this.withCredentials), o.load(s, (i) => {
      try {
        t(this.parse(i));
      } catch (e) {
        r ? r(e) : console.error(e), this.manager.itemError(s);
      }
    }, a, r);
  }
  parse(s) {
    var o;
    if (this.arraybuffer = s, this.data = new DataView(s), this.position = 0, this.textures = /* @__PURE__ */ new Map(), this.readHeader().type !== A.CHUNK_TEXDICTIONARY)
      throw new Error("TXDLoader: Not a valid TXD file");
    this.readHeader();
    const a = this.readUInt16(), r = this.readUInt16();
    console.log(`TXDLoader: Loading ${a} textures (device: ${r})`);
    for (let i = 0; i < a; i++)
      try {
        const e = this.readTextureNative();
        e && (this.textures.set(e.name.toLowerCase(), { texture: e.texture, hasAlpha: e.hasAlpha }), console.log(`TXDLoader: Loaded texture "${e.name}" (${e.width}x${e.height}, compression: ${e.compression}, format: 0x${((o = e.d3dFormat) == null ? void 0 : o.toString(16)) || "N/A"}, alpha: ${e.hasAlpha})`));
      } catch (e) {
        console.warn(`TXDLoader: Failed to load texture ${i}:`, e.message);
      }
    return this.textures;
  }
  readHeader() {
    return {
      type: this.readUInt32(),
      length: this.readUInt32(),
      build: this.readUInt32()
    };
  }
  readTextureNative() {
    const s = this.readHeader();
    if (s.type !== A.CHUNK_TEXTURENATIVE)
      return this.position += s.length, null;
    const t = this.position + s.length;
    this.readHeader();
    const a = this.readUInt32();
    this.readUInt32();
    const r = this.readString(32), o = this.readString(32), i = this.readUInt32();
    let e, n, x, f, U = !1, T = 0;
    if (a === 9)
      T = this.readUInt32(), e = this.readUInt16(), n = this.readUInt16(), this.readUInt8(), x = this.readUInt8(), this.readUInt8(), f = this.readUInt8(), U = T === D.D3DFMT_DXT3 || T === D.D3DFMT_DXT5 || T === D.D3DFMT_A8R8G8B8 || T === D.D3DFMT_A4R4G4B4 || T === D.D3DFMT_A1R5G5B5;
    else if (a === 8)
      U = this.readUInt32() !== 0, e = this.readUInt16(), n = this.readUInt16(), this.readUInt8(), x = this.readUInt8(), this.readUInt8(), f = this.readUInt8();
    else
      return console.warn(`TXDLoader: Unsupported platform ID: ${a}`), this.position = t, null;
    const p = (i & L.FORMAT_EXT_PAL8) !== 0, H = (i & L.FORMAT_EXT_PAL4) !== 0;
    let d = null;
    if (p) {
      d = new Uint8Array(256 * 4);
      for (let g = 0; g < 256; g++)
        d[g * 4 + 2] = this.readUInt8(), d[g * 4 + 1] = this.readUInt8(), d[g * 4 + 0] = this.readUInt8(), d[g * 4 + 3] = this.readUInt8();
    } else if (H) {
      d = new Uint8Array(64);
      for (let g = 0; g < 16; g++)
        d[g * 4 + 2] = this.readUInt8(), d[g * 4 + 1] = this.readUInt8(), d[g * 4 + 0] = this.readUInt8(), d[g * 4 + 3] = this.readUInt8();
    }
    const c = this.readUInt32(), C = new Uint8Array(this.arraybuffer.slice(this.position, this.position + c));
    this.position += c;
    let l;
    f === 1 || f === 8 ? l = this.decodeDXT1(C, e, n) : f === 3 || f === 9 ? l = this.decodeDXT3(C, e, n) : f === 5 ? l = this.decodeDXT5(C, e, n) : p ? l = this.decodePal8(C, d, e, n) : H ? l = this.decodePal4(C, d, e, n) : l = this.decodeUncompressed(C, e, n, T, i);
    for (let g = 1; g < x; g++) {
      const R = this.readUInt32();
      this.position += R;
    }
    const M = this.readHeader();
    this.position += M.length;
    const E = new m.DataTexture(
      l,
      e,
      n,
      m.RGBAFormat,
      m.UnsignedByteType
    );
    return E.name = r, E.wrapS = m.RepeatWrapping, E.wrapT = m.RepeatWrapping, E.magFilter = m.LinearFilter, E.minFilter = m.LinearMipmapLinearFilter, E.generateMipmaps = !0, E.colorSpace = m.SRGBColorSpace, E.flipY = !1, E.needsUpdate = !0, {
      name: r,
      alphaName: o,
      width: e,
      height: n,
      hasAlpha: U,
      compression: f,
      d3dFormat: T,
      texture: E
    };
  }
  // DXT1 decoder (4bpp, optional 1-bit alpha)
  decodeDXT1(s, t, a) {
    const r = new Uint8Array(t * a * 4), o = Math.ceil(t / 4), i = Math.ceil(a / 4);
    let e = 0;
    for (let n = 0; n < i; n++)
      for (let x = 0; x < o; x++) {
        const f = s[e] | s[e + 1] << 8, U = s[e + 2] | s[e + 3] << 8;
        e += 4;
        const T = [];
        T[0] = this.rgb565ToRgba(f), T[1] = this.rgb565ToRgba(U), f > U ? (T[2] = this.interpolateColor(T[0], T[1], 1 / 3), T[3] = this.interpolateColor(T[0], T[1], 2 / 3)) : (T[2] = this.interpolateColor(T[0], T[1], 0.5), T[3] = [0, 0, 0, 0]);
        const p = s[e] | s[e + 1] << 8 | s[e + 2] << 16 | s[e + 3] << 24;
        e += 4;
        for (let H = 0; H < 4; H++)
          for (let d = 0; d < 4; d++) {
            const c = x * 4 + d, C = n * 4 + H;
            if (c >= t || C >= a) continue;
            const l = p >> (H * 4 + d) * 2 & 3, M = T[l], E = (C * t + c) * 4;
            r[E + 0] = M[0], r[E + 1] = M[1], r[E + 2] = M[2], r[E + 3] = M[3];
          }
      }
    return r;
  }
  // DXT3 decoder (8bpp, explicit 4-bit alpha)
  decodeDXT3(s, t, a) {
    const r = new Uint8Array(t * a * 4), o = Math.ceil(t / 4), i = Math.ceil(a / 4);
    let e = 0;
    for (let n = 0; n < i; n++)
      for (let x = 0; x < o; x++) {
        const f = [];
        for (let d = 0; d < 8; d++)
          f.push(s[e + d]);
        e += 8;
        const U = s[e] | s[e + 1] << 8, T = s[e + 2] | s[e + 3] << 8;
        e += 4;
        const p = [];
        p[0] = this.rgb565ToRgba(U), p[1] = this.rgb565ToRgba(T), p[2] = this.interpolateColor(p[0], p[1], 1 / 3), p[3] = this.interpolateColor(p[0], p[1], 2 / 3);
        const H = s[e] | s[e + 1] << 8 | s[e + 2] << 16 | s[e + 3] << 24;
        e += 4;
        for (let d = 0; d < 4; d++)
          for (let c = 0; c < 4; c++) {
            const C = x * 4 + c, l = n * 4 + d;
            if (C >= t || l >= a) continue;
            const M = H >> (d * 4 + c) * 2 & 3, E = p[M], g = d * 4 + c, R = f[Math.floor(g / 2)], h = (g % 2 === 0 ? R & 15 : R >> 4) * 17, u = (l * t + C) * 4;
            r[u + 0] = E[0], r[u + 1] = E[1], r[u + 2] = E[2], r[u + 3] = h;
          }
      }
    return r;
  }
  // DXT5 decoder (8bpp, interpolated alpha)
  decodeDXT5(s, t, a) {
    const r = new Uint8Array(t * a * 4), o = Math.ceil(t / 4), i = Math.ceil(a / 4);
    let e = 0;
    for (let n = 0; n < i; n++)
      for (let x = 0; x < o; x++) {
        const f = s[e], U = s[e + 1];
        e += 2;
        let T = 0n;
        for (let l = 0; l < 6; l++)
          T |= BigInt(s[e + l]) << BigInt(l * 8);
        e += 6;
        const p = [f, U];
        if (f > U)
          for (let l = 1; l <= 6; l++)
            p.push(Math.floor(((7 - l) * f + l * U) / 7));
        else {
          for (let l = 1; l <= 4; l++)
            p.push(Math.floor(((5 - l) * f + l * U) / 5));
          p.push(0), p.push(255);
        }
        const H = s[e] | s[e + 1] << 8, d = s[e + 2] | s[e + 3] << 8;
        e += 4;
        const c = [];
        c[0] = this.rgb565ToRgba(H), c[1] = this.rgb565ToRgba(d), c[2] = this.interpolateColor(c[0], c[1], 1 / 3), c[3] = this.interpolateColor(c[0], c[1], 2 / 3);
        const C = s[e] | s[e + 1] << 8 | s[e + 2] << 16 | s[e + 3] << 24;
        e += 4;
        for (let l = 0; l < 4; l++)
          for (let M = 0; M < 4; M++) {
            const E = x * 4 + M, g = n * 4 + l;
            if (E >= t || g >= a) continue;
            const R = C >> (l * 4 + M) * 2 & 3, h = c[R], u = l * 4 + M, F = Number(T >> BigInt(u * 3) & 0x7n), N = p[F], I = (g * t + E) * 4;
            r[I + 0] = h[0], r[I + 1] = h[1], r[I + 2] = h[2], r[I + 3] = N;
          }
      }
    return r;
  }
  // Palette 8-bit decoder
  decodePal8(s, t, a, r) {
    const o = new Uint8Array(a * r * 4);
    for (let i = 0; i < a * r; i++) {
      const e = s[i];
      o[i * 4 + 0] = t[e * 4 + 0], o[i * 4 + 1] = t[e * 4 + 1], o[i * 4 + 2] = t[e * 4 + 2], o[i * 4 + 3] = t[e * 4 + 3];
    }
    return o;
  }
  // Palette 4-bit decoder
  decodePal4(s, t, a, r) {
    const o = new Uint8Array(a * r * 4);
    for (let i = 0; i < a * r; i++) {
      const e = Math.floor(i / 2), n = i % 2 === 0 ? s[e] & 15 : s[e] >> 4;
      o[i * 4 + 0] = t[n * 4 + 0], o[i * 4 + 1] = t[n * 4 + 1], o[i * 4 + 2] = t[n * 4 + 2], o[i * 4 + 3] = t[n * 4 + 3];
    }
    return o;
  }
  // Uncompressed decoder
  decodeUncompressed(s, t, a, r, o) {
    const i = new Uint8Array(t * a * 4), e = o & 3840;
    for (let n = 0; n < t * a; n++) {
      let x, f, U, T;
      if (r === D.D3DFMT_A8R8G8B8 || e === L.FORMAT_8888)
        U = s[n * 4 + 0], f = s[n * 4 + 1], x = s[n * 4 + 2], T = s[n * 4 + 3];
      else if (r === D.D3DFMT_X8R8G8B8)
        U = s[n * 4 + 0], f = s[n * 4 + 1], x = s[n * 4 + 2], T = 255;
      else if (e === L.FORMAT_888)
        U = s[n * 3 + 0], f = s[n * 3 + 1], x = s[n * 3 + 2], T = 255;
      else if (r === D.D3DFMT_R5G6B5 || e === L.FORMAT_565) {
        const p = s[n * 2] | s[n * 2 + 1] << 8;
        x = (p >> 11 & 31) * 255 / 31, f = (p >> 5 & 63) * 255 / 63, U = (p & 31) * 255 / 31, T = 255;
      } else if (r === D.D3DFMT_A1R5G5B5 || e === L.FORMAT_1555) {
        const p = s[n * 2] | s[n * 2 + 1] << 8;
        T = p >> 15 ? 255 : 0, x = (p >> 10 & 31) * 255 / 31, f = (p >> 5 & 31) * 255 / 31, U = (p & 31) * 255 / 31;
      } else if (r === D.D3DFMT_A4R4G4B4 || e === L.FORMAT_4444) {
        const p = s[n * 2] | s[n * 2 + 1] << 8;
        T = (p >> 12 & 15) * 17, x = (p >> 8 & 15) * 17, f = (p >> 4 & 15) * 17, U = (p & 15) * 17;
      } else
        U = s[n * 4 + 0] || 0, f = s[n * 4 + 1] || 0, x = s[n * 4 + 2] || 0, T = s[n * 4 + 3] || 255;
      i[n * 4 + 0] = x, i[n * 4 + 1] = f, i[n * 4 + 2] = U, i[n * 4 + 3] = T;
    }
    return i;
  }
  // Helper: RGB565 to RGBA
  rgb565ToRgba(s) {
    const t = (s >> 11 & 31) * 255 / 31, a = (s >> 5 & 63) * 255 / 63, r = (s & 31) * 255 / 31;
    return [Math.round(t), Math.round(a), Math.round(r), 255];
  }
  // Helper: Interpolate colors
  interpolateColor(s, t, a) {
    return [
      Math.round(s[0] + (t[0] - s[0]) * a),
      Math.round(s[1] + (t[1] - s[1]) * a),
      Math.round(s[2] + (t[2] - s[2]) * a),
      255
    ];
  }
  // Binary readers
  readUInt32() {
    const s = this.data.getUint32(this.position, !0);
    return this.position += 4, s;
  }
  readUInt16() {
    const s = this.data.getUint16(this.position, !0);
    return this.position += 2, s;
  }
  readUInt8() {
    const s = this.data.getUint8(this.position);
    return this.position += 1, s;
  }
  readString(s) {
    let t = "";
    for (let a = 0; a < s; a++) {
      const r = this.data.getUint8(this.position + a);
      if (r === 0) break;
      t += String.fromCharCode(r);
    }
    return this.position += s, t.trim();
  }
  // Get texture by name
  getTexture(s) {
    return this.textures.get(s.toLowerCase());
  }
}
export {
  S as DFFLoader,
  B as TXDLoader
};
