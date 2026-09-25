# Blender side of the VLibras route B export (ADR-0234, route B, phase B1). Driven by scripts/libras-export.mjs.
#
# RUN ONLY AS the driver runs it:
#     blender --background --factory-startup --disable-autoexec --python export.py -- --job <job.json>
# `--disable-autoexec` is what keeps the Python text blocks embedded in every LAViD `.blend` from running; this script
# also opens each file with `use_scripts=False` and never touches `bpy.data.texts` beyond counting them.
#
# For each sign in the job it opens `<NAME>.blend` (a Blender 2.79 file: the WHOLE avatar plus one Action named after the
# sign), assigns that Action to the armature, and writes:
#   <out>/raw/<index>.glb   the avatar + that one action, sampled every frame by Blender's own glTF exporter, so the
#                           constraints (COPY_LOCATION from the IK targets, TRACK_TO of the eyes) are BAKED into plain
#                           bone tracks. The driver (node) turns it into the compact clip and throws it away.
#   <out>/report/<index>.json   what was read: action name and frame range, frame rate, what is lost, how far this file's
#                           avatar is from the avatar sign's (`identity`), and a few bone world positions / shape-key
#                           values at a few frames, which the driver compares with the exported clip (a numeric
#                           end-to-end check); and `morphs`, the face's shape-key values at every frame (sample_morphs).
# The ONE sign the job marks `avatar` is also exported once, with no animation, as <out>/avatar.glb.
#
# MATERIALS: the 2.79 files use Blender Internal materials whose colours come from image textures (`TxCorpo.png`,
# `cabecaAvatarCartoon.png`) that most files reference by an absolute path on LAViD's machines and do not contain. Blender 5.2
# turns each BI material into a node tree the glTF exporter does not read (it exported no colour at all), so every avatar
# material is rebuilt here as one Principled BSDF with the material's own colour, and the head and the body get their image
# back from a sign file that PACKS it (the job's `textures`; see TEXTURED).
import bpy
import hashlib
import json
import math
import os
import sys
import traceback


# Bones whose world head position the report samples, for the driver's end-to-end check (hands, head, a fingertip).
PROBE_BONES = ["BnMao.L", "BnMao.R", "BnCabeca", "BnDedo.1.L.004", "BnDedo.1.R.004", "BnAntBraco.L"]


def arg(name, default=None):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return argv[argv.index(name) + 1] if name in argv else default


def digest(obj):
    return hashlib.sha256(json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()


def flat(m):
    return [float(x) for row in m for x in row]


def find_armature():
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    if not arms:
        raise RuntimeError("no armature")
    return max(arms, key=lambda o: len(o.data.bones))


def avatar_meshes(arm):
    # The avatar is every RENDERED mesh the armature deforms. Excluded by this rule, and on purpose: the bone-shape
    # widgets (Ctrl*), the helper sphere, and the glasses (OCULOS*), which are parented to the head but hidden from render.
    out = []
    for o in bpy.data.objects:
        if o.type != "MESH" or o.hide_render:
            continue
        if any(m.type == "ARMATURE" and m.object == arm for m in o.modifiers):
            out.append(o)
    return sorted(out, key=lambda o: o.name)


# AVATAR IDENTITY. Every sign's file carries its own copy of the avatar, and one exported avatar serves every clip only if
# those copies are the same. Each part (armature, rig, materials, each mesh) is split in two: its SHAPE — names, topology,
# vertex-group membership, parents — which must be EQUAL (compared by sha256), and its NUMBERS — coordinates, bone matrices,
# weights, UVs, shape-key offsets, colours — which are compared with the avatar sign's file (`reference.json`) as the largest
# absolute difference. A hash of rounded floats was tried first and is wrong: two files 1e-7 apart land on the two sides of a
# rounding boundary and hash differently (measured: ESCOLA and PEIXE, whose bones differ by less than 1e-5 from CASA's).
def identity_parts(arm, meshes):
    parts = {}
    bones = sorted(arm.data.bones, key=lambda b: b.name)
    parts["armature"] = {
        "shape": [arm.name] + [[b.name, b.parent.name if b.parent else None, b.use_deform, b.use_connect] for b in bones],
        "numbers": flat(arm.matrix_basis) + [x for b in bones for x in flat(b.matrix_local) + list(b.tail_local)],
    }
    cons = [(pb, c) for pb in sorted(arm.pose.bones, key=lambda p: p.name) for c in pb.constraints]
    drivers = []
    for o in meshes:
        key = o.data.shape_keys
        if key and key.animation_data:
            drivers += [(o, d) for d in sorted(key.animation_data.drivers, key=lambda d: d.data_path)]
    parts["rig"] = {
        "shape": [[pb.name, c.type, getattr(c, "target", None) and c.target.name, getattr(c, "subtarget", ""), c.mute]
                  for pb, c in cons]
        + [[o.name, d.data_path, d.driver.type, d.driver.expression, d.extrapolation, len(d.keyframe_points),
            [[v.type, [[t.id.name if t.id else None, t.bone_target, t.transform_type, t.transform_space]
                       for t in v.targets]] for v in d.driver.variables]] for o, d in drivers],
        "numbers": [c.influence for _, c in cons] + [x for _, d in drivers for k in d.keyframe_points for x in k.co],
    }
    mats = []
    for o in meshes:
        for m in o.data.materials:
            if m and m.name not in [x.name for x in mats]:
                mats.append(m)
    parts["materials"] = {"shape": [m.name for m in mats], "numbers": [x for m in mats for x in m.diffuse_color]}
    for o in meshes:
        me = o.data
        keys = list(me.shape_keys.key_blocks) if me.shape_keys else []
        parts["mesh:" + o.name] = {
            "shape": [o.parent.name if o.parent else None, len(me.vertices), [list(p.vertices) for p in me.polygons],
                      [p.material_index for p in me.polygons], [g.name for g in o.vertex_groups],
                      [[g.group for g in v.groups] for v in me.vertices], [uv.name for uv in me.uv_layers],
                      [m.name if m else None for m in me.materials], [[k.name, k.relative_key.name] for k in keys]],
            "numbers": flat(o.matrix_basis) + flat(o.matrix_parent_inverse) + [c for v in me.vertices for c in v.co]
            + [g.weight for v in me.vertices for g in v.groups] + [c for uv in me.uv_layers for d in uv.data for c in d.uv]
            + [x for k in keys for x in [k.slider_min, k.slider_max] + [c for v in k.data for c in v.co]],
        }
    return parts


def identity(parts, reference):
    # `shape`: sha256 of each part's shape. `maxDiff`: per part, the largest |number - reference|, or a string saying why the
    # numbers cannot be compared (the shape differs, or the part is missing on one side).
    out = {"shape": {k: digest(v["shape"]) for k, v in parts.items()}, "maxDiff": {}}
    for k in sorted(set(parts) | set(reference)):
        if k not in parts or k not in reference:
            out["maxDiff"][k] = "missing here" if k not in parts else "missing in the reference"
        elif digest(parts[k]["shape"]) != reference[k]["shape"]:
            out["maxDiff"][k] = "shape differs"
        elif len(parts[k]["numbers"]) != len(reference[k]["numbers"]):
            out["maxDiff"][k] = "shape differs"
        else:
            out["maxDiff"][k] = max((abs(a - b) for a, b in zip(parts[k]["numbers"], reference[k]["numbers"])), default=0.0)
    return out


def neutral_pose(arm):
    # The avatar is exported in its REST pose with its shape keys at what the drivers give for that pose. Without this, the
    # default morph weights are whatever pose the file was saved in (measured: CASA saved with the lower lip pushed, so
    # `Bico` defaulted to 0.913 and every clip without a `Bico` track would pout).
    if arm.animation_data:
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()


def pick_action(name):
    act = bpy.data.actions.get(name)
    if act is None and len(bpy.data.actions) == 1:
        act = bpy.data.actions[0]
    if act is None:
        raise RuntimeError("no action named %r among %r" % (name, [a.name for a in bpy.data.actions]))
    return act


def action_fcurves(act):
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


def losses(arm, meshes, act):
    # What Blender 5.2 does NOT carry into glTF, counted so the report can say whether it matters.
    fcs = action_fcurves(act)
    return {
        "constraints": sum(len(pb.constraints) for pb in arm.pose.bones),
        "constraintFcurves": sum(1 for fc in fcs if ".constraints[" in fc.data_path),
        "nonBoneFcurves": sorted({fc.data_path for fc in fcs if not fc.data_path.startswith("pose.bones[")}),
        "fcurveModifiers": sum(len(fc.modifiers) for fc in fcs),
        "interpolations": sorted({k.interpolation for fc in fcs for k in fc.keyframe_points}),
        "shapeKeyDrivers": sum(len(o.data.shape_keys.animation_data.drivers) for o in meshes
                               if o.data.shape_keys and o.data.shape_keys.animation_data),
        "scriptedDrivers": sum(1 for o in meshes if o.data.shape_keys and o.data.shape_keys.animation_data
                               for d in o.data.shape_keys.animation_data.drivers
                               if d.driver.type == "SCRIPTED"),
        "modifiersNotApplied": sorted({m.type for o in meshes for m in o.modifiers if m.type != "ARMATURE"}),
        "imagesMissing": sorted(i.name for i in bpy.data.images if not i.packed_file and i.source == "FILE"
                                and not os.path.exists(bpy.path.abspath(i.filepath))),
        "imageTextureNodes": sum(1 for o in meshes for m in o.data.materials if m and m.node_tree
                                 for n in m.node_tree.nodes if n.type == "TEX_IMAGE"),
        "legacyTextures": len(bpy.data.textures),
        "textBlocksNotRun": len(bpy.data.texts),
        "hiddenMeshesExcluded": sorted(o.name for o in bpy.data.objects if o.type == "MESH" and o.hide_render),
    }


def probe(arm, meshes, act, frames):
    # glTF is Y-up: Blender (x, y, z) -> glTF (x, z, -y). World HEAD of each probe bone, and the head's shape-key values.
    scene = bpy.context.scene
    out = []
    head = next((o for o in meshes if o.data.shape_keys), None)
    for f in frames:
        scene.frame_set(int(f))
        bones = {}
        for name in PROBE_BONES:
            pb = arm.pose.bones.get(name)
            if pb:
                p = arm.matrix_world @ pb.head
                bones[name] = [p.x, p.z, -p.y]
        keys = {}
        if head:
            ev = head.evaluated_get(bpy.context.evaluated_depsgraph_get())
            for kb in ev.data.shape_keys.key_blocks if ev.data.shape_keys else head.data.shape_keys.key_blocks:
                keys[kb.name] = kb.value
            keys = {"mesh": head.name, "values": keys}
        out.append({"frame": f, "bones": bones, "shapeKeys": keys})
    return out


def exported_keys(key):
    # The glTF exporter's own rule (`skip_sk`): not the Basis, not a muted key, not a key relative to itself. The order of
    # what remains is the order of the avatar's morph targets (`extras.targetNames`).
    return [kb for i, kb in enumerate(key.key_blocks) if i > 0 and not kb.mute and kb.relative_key != kb]


def sample_morphs(meshes, first, last):
    # THE FACE, sampled here and not by the exporter. The face's shape keys are moved by DRIVERS reading facial bones; the
    # exporter bakes those only sometimes (measured over the 632 signs: FAZER, O_QUE, PRECISAR and others came out with no
    # weights channel at all, while Blender itself gives `Bico` 1.0 and `FranzirSobrancelha` 1.0 mid-sign in O_QUE). So every
    # frame is evaluated here, with the same depsgraph that poses the bones, and the driver writes the tracks.
    scene = bpy.context.scene
    out = []
    for o in meshes:
        if not o.data.shape_keys:
            continue
        names = [kb.name for kb in exported_keys(o.data.shape_keys)]
        values = []
        for f in range(first, last + 1):
            scene.frame_set(f)
            ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get()).data.shape_keys
            values.append([ev.key_blocks[n].value for n in names])
        out.append({"mesh": o.name, "names": names, "values": values})
    return out


FLAT_ROUGHNESS = 0.7  # a choice of this pipeline, not of the source: BI's specular model has no glTF counterpart

# THE AVATAR'S TEXTURES. Most sign files only POINT at their images (a path on LAViD's machines); twelve of the 632 — the
# digits 0-9, M and O — carry them PACKED. Which material used which image was a Blender Internal texture slot, which Blender
# 5.2 does not load; read from the 2.79 file's own DNA (material → MTex slot 0 → Tex → Image), both are UV-mapped colour at
# full strength (MIX, 1.0). Kept out, and said: CABECA's 2nd slot (the same image, SCREEN 0.3), MatCORPO's 2nd slot
# (`TxCorpo.tga.png`, an occlusion map, OVERLAY 0.4), and CABELO's normal map, which no file carries.
TEXTURED = {"CABECA": "cabecaAvatarCartoon.p", "MatCORPO": "TxCorpo.png"}


def load_textures(blend):
    # Appends only the Image datablocks (no object, no text block) from `blend`; the list comes back in the order asked.
    wanted = sorted(set(TEXTURED.values()))
    with bpy.data.libraries.load(blend, link=False) as (src, dst):
        missing = [n for n in wanted if n not in src.images]
        dst.images = [] if missing else list(wanted)  # a COPY: Blender swaps the names for datablocks in the list it is given
    if missing:
        raise RuntimeError("textures %r are not in %s" % (missing, blend))
    images = dict(zip(wanted, dst.images))
    for name, img in images.items():
        if img is None or not img.packed_file:
            raise RuntimeError("texture %s in %s is not packed" % (name, blend))
    return images


def flatten_materials(meshes, images=None):
    done = set()
    for o in meshes:
        for m in o.data.materials:
            if not m or m.name in done:
                continue
            done.add(m.name)
            color = list(m.diffuse_color)
            for n in (m.node_tree.nodes if m.node_tree else []):
                if n.type == "BSDF_PRINCIPLED":
                    color = list(n.inputs["Base Color"].default_value)
            nodes = m.node_tree.nodes
            nodes.clear()
            bsdf = nodes.new("ShaderNodeBsdfPrincipled")
            bsdf.inputs["Base Color"].default_value = color
            bsdf.inputs["Metallic"].default_value = 0.0
            bsdf.inputs["Roughness"].default_value = FLAT_ROUGHNESS
            out = nodes.new("ShaderNodeOutputMaterial")
            out.target = "ALL"
            m.node_tree.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
            out.is_active_output = True
            if images and m.name in TEXTURED:
                tex = nodes.new("ShaderNodeTexImage")
                tex.image = images[TEXTURED[m.name]]
                m.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])


def select_only(objs):
    view = bpy.context.view_layer
    for o in objs:
        if view.objects.get(o.name) is None:
            bpy.context.scene.collection.objects.link(o)
    for o in view.objects:
        o.select_set(False)
    for o in objs:
        o.hide_set(False)
        o.hide_viewport = False
        o.select_set(True)
    view.objects.active = objs[0]


EXPORT_OPTIONS = dict(
    export_format="GLB", use_selection=True, export_apply=False, export_yup=True,
    export_texcoords=True, export_normals=True, export_tangents=False, export_materials="EXPORT",
    export_cameras=False, export_lights=False, export_extras=False,
    export_skins=True, export_def_bones=False, export_rest_position_armature=True, export_all_influences=False,
    export_morph=True, export_morph_normal=True, export_morph_tangent=False,
)
ANIMATION_OPTIONS = dict(
    export_animations=True, export_animation_mode="ACTIVE_ACTIONS", export_frame_range=False, export_frame_step=1,
    export_force_sampling=True, export_anim_slide_to_zero=True, export_optimize_animation_size=True,
    export_anim_single_armature=True, export_reset_pose_bones=True,
    export_morph_animation=False,  # the face comes from sample_morphs, never half from the exporter
)


def export(path, animations, def_bones):
    known = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    opts = dict(EXPORT_OPTIONS, export_def_bones=def_bones)
    opts.update(ANIMATION_OPTIONS if animations else {"export_animations": False})
    unknown = sorted(k for k in opts if k not in known)
    if unknown:
        raise RuntimeError("the glTF exporter of this Blender lacks options %r" % unknown)
    res = bpy.ops.export_scene.gltf(filepath=path, **opts)
    if "FINISHED" not in res:
        raise RuntimeError("glTF export returned %r" % (res,))


def one(sign, out, index, reference_file, def_bones):
    bpy.ops.wm.open_mainfile(filepath=sign["blend"], load_ui=False, use_scripts=False)
    scene = bpy.context.scene
    arm = find_armature()
    meshes = avatar_meshes(arm)
    act = pick_action(sign["name"])
    keyed = [float(x) for x in act.frame_range]
    # Whole frames, set on the action itself so the exporter samples exactly these: a key may sit between frames
    # (FLORESTA starts at 0.808), and the exporter floors the start — a probe at 0.808 against a clip whose 0 s is frame 0
    # read the hands 8 cm off.
    start, end = math.floor(keyed[0]), math.ceil(keyed[1])
    act.use_frame_range = True
    act.frame_start, act.frame_end = start, end
    report = {
        "name": sign["name"], "action": act.name, "fileVersion": list(bpy.data.version),
        "blender": bpy.app.version_string, "frameStart": start, "frameEnd": end, "keyedRange": keyed,
        "fps": scene.render.fps / scene.render.fps_base, "fcurves": len(action_fcurves(act)),
        "armature": arm.name, "bones": len(arm.data.bones), "meshes": [o.name for o in meshes],
        "actions": [a.name for a in bpy.data.actions],
    }
    parts = identity_parts(arm, meshes)
    if sign.get("avatar"):  # THE avatar: its numbers become the reference every other sign is compared with
        with open(reference_file, "w", encoding="utf-8") as f:
            json.dump({k: {"shape": digest(v["shape"]), "numbers": v["numbers"]} for k, v in parts.items()}, f)
    with open(reference_file, encoding="utf-8") as f:
        report["identity"] = identity(parts, json.load(f))
    report["losses"] = losses(arm, meshes, act)
    images = load_textures(sign["textures"]) if sign.get("avatar") and sign.get("textures") else None
    if images:
        report["textures"] = {m: {"image": n, "size": list(images[n].size), "packedBytes": images[n].packed_file.size}
                              for m, n in TEXTURED.items()}
    flatten_materials(meshes, images)
    neutral_pose(arm)  # in EVERY file: a bone the action does not key stays at rest, as the exporter's own sampling assumes
    if sign.get("avatar"):
        select_only([arm] + meshes)
        export(os.path.join(out, "avatar.glb"), animations=False, def_bones=def_bones)
    arm.animation_data_create()
    arm.animation_data.action = act
    if len(act.slots) and arm.animation_data.action_slot is None:
        arm.animation_data.action_slot = act.slots[0]
    report["probe"] = probe(arm, meshes, act, [start, (start + end) // 2, end])
    report["morphs"] = sample_morphs(meshes, start, end)
    select_only([arm] + meshes)
    scene.frame_set(start)
    export(os.path.join(out, "raw", "%d.glb" % index), animations=True, def_bones=def_bones)
    return report


def main():
    job = json.load(open(arg("--job"), encoding="utf-8"))
    out = job["out"]
    os.makedirs(os.path.join(out, "raw"), exist_ok=True)
    os.makedirs(os.path.join(out, "report"), exist_ok=True)
    for sign in job["signs"]:
        index = sign["index"]
        try:
            rep = one(sign, out, index, os.path.join(out, "reference.json"), job.get("defBones", False))
        except Exception as e:  # one broken source must not stop the batch; the driver reports it
            rep = {"name": sign["name"], "error": "%s: %s" % (type(e).__name__, e), "trace": traceback.format_exc()}
        with open(os.path.join(out, "report", "%d.json" % index), "w", encoding="utf-8") as f:
            json.dump(rep, f, ensure_ascii=False)
        print("LIBRAS-EXPORT", index, sign["name"], "error" if "error" in rep else "ok", flush=True)


main()
