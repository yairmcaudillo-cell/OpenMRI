"""3D surface models from label maps, without extra dependencies.

A region of a label map becomes a closed triangle mesh: the boundary faces of
its voxels are joined into a surface, which Taubin smoothing then rounds off
without shrinking it. Vertices are in the volume's world coordinates (RAS mm),
so a mesh lines up with the scan it came from. Meshes are written as binary
STL, which NiiVue displays and 3D printers accept.

This draws the regions a label map already contains; it does not find them.
"""
import struct
from pathlib import Path

import numpy as np
from scipy import sparse


def _fill_edge_contacts(mask):
    """Fill one gap wherever two voxels touch only along an edge.

    Such contacts make edges shared by four faces, which 3D-printing tools
    reject. Filling changes a few surface voxels; the surface stays closed.
    """
    m = mask.copy()
    for _ in range(20):
        changed = False
        for a, b in ((0, 1), (0, 2), (1, 2)):
            def s(da, db):
                idx = [slice(None)] * 3
                idx[a] = slice(da, m.shape[a] - 1 + da)
                idx[b] = slice(db, m.shape[b] - 1 + db)
                return tuple(idx)
            p00, p10, p01, p11 = m[s(0, 0)], m[s(1, 0)], m[s(0, 1)], m[s(1, 1)]
            first = p00 & p11 & ~p10 & ~p01  # fill the (1, 0) gap
            second = p10 & p01 & ~p00 & ~p11  # fill the (0, 0) gap
            if first.any() or second.any():
                m[s(1, 0)] |= first
                m[s(0, 0)] |= second
                changed = True
        if not changed:
            break
    return m


def _boundary_quads(mask):
    """Quads (n, 4, 3) on the corner lattice, wound so normals point outward."""
    m = np.pad(mask.astype(np.int8), 1)
    quads = []
    for a in range(3):
        b, c = (a + 1) % 3, (a + 2) % 3
        diff = np.diff(m, axis=a)
        for sign in (-1, 1):  # -1: inside then outside along +a, normal +a
            idx = np.argwhere(diff == sign)
            if not len(idx):
                continue
            base = idx.copy()
            base[:, a] += 1  # the plane between voxel i and i+1
            corners = np.repeat(base[:, None, :], 4, axis=1)
            for k, (db, dc) in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
                corners[:, k, b] += db
                corners[:, k, c] += dc
            if sign == 1:  # outside then inside: normal -a, reverse the winding
                corners = corners[:, ::-1]
            quads.append(corners)
    return np.concatenate(quads) if quads else np.zeros((0, 4, 3), int)


def _taubin(vertices, faces, iterations=20, lam=0.5, mu=-0.53):
    edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    n = len(vertices)
    adjacency = sparse.coo_matrix(
        (np.ones(len(edges) * 2), (np.r_[edges[:, 0], edges[:, 1]], np.r_[edges[:, 1], edges[:, 0]])),
        shape=(n, n),
    ).tocsr()
    adjacency.data[:] = 1  # duplicate edges count once
    degree = np.asarray(adjacency.sum(axis=1)).ravel()
    degree[degree == 0] = 1
    v = vertices.astype(float)
    for _ in range(iterations):
        for factor in (lam, mu):
            v = v + factor * (adjacency @ v / degree[:, None] - v)
    return v


def label_mesh(mask, affine, smooth=True):
    """Vertices (world mm) and triangles of the surface of a boolean volume."""
    quads = _boundary_quads(_fill_edge_contacts(np.asarray(mask, bool)))
    if not len(quads):
        return np.zeros((0, 3)), np.zeros((0, 3), int)
    corners, inverse = np.unique(quads.reshape(-1, 3), axis=0, return_inverse=True)
    q = inverse.reshape(-1, 4)
    faces = np.concatenate([q[:, [0, 1, 2]], q[:, [0, 2, 3]]])
    vertices = corners - 1.5  # corner lattice -> voxel index (padding and half voxel)
    if smooth:
        vertices = _taubin(vertices, faces)
    world = (affine @ np.c_[vertices, np.ones(len(vertices))].T).T[:, :3]
    if np.linalg.det(affine[:3, :3]) < 0:  # a mirrored grid flips the winding
        faces = faces[:, ::-1]
    return world, faces


def write_stl(path, vertices, faces):
    tri = vertices[faces].astype(np.float32)
    normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    length = np.linalg.norm(normals, axis=1, keepdims=True)
    normals = (normals / np.where(length == 0, 1, length)).astype(np.float32)
    record = np.zeros(len(tri), dtype=[('n', '<f4', 3), ('v', '<f4', (3, 3)), ('attr', '<u2')])
    record['n'] = normals
    record['v'] = tri
    with open(path, 'wb') as f:
        f.write(b'OpenMRI label surface'.ljust(80, b' '))
        f.write(struct.pack('<I', len(tri)))
        f.write(record.tobytes())


def read_stl(path):
    data = Path(path).read_bytes()
    count = struct.unpack('<I', data[80:84])[0]
    record = np.frombuffer(data, dtype=[('n', '<f4', 3), ('v', '<f4', (3, 3)), ('attr', '<u2')], count=count, offset=84)
    return record['v'].astype(float)
