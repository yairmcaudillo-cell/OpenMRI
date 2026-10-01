import struct
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from meshes import label_mesh, read_stl, write_stl


def sphere(radius=10, size=40):
    z, y, x = np.mgrid[:size, :size, :size]
    c = (size - 1) / 2
    return ((x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2) <= radius**2


class MeshTests(unittest.TestCase):
    def test_a_sphere_becomes_a_closed_surface_at_the_right_radius(self):
        affine = np.diag([1.0, 1.0, 1.0, 1.0])
        vertices, faces = label_mesh(sphere(), affine)
        self.assertGreater(len(faces), 500)
        # Closed and manifold: every edge belongs to exactly two triangles.
        edges = Counter(tuple(sorted(e)) for f in faces for e in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])))
        self.assertEqual(set(edges.values()), {2})
        centre = np.array([19.5, 19.5, 19.5])
        radii = np.linalg.norm(vertices - centre, axis=1)
        self.assertLess(abs(radii.mean() - 10), 1.0, radii.mean())
        self.assertLess(radii.std(), 1.0)

    def test_vertices_are_in_world_millimetres(self):
        affine = np.array([[2.0, 0, 0, -50], [0, 2.0, 0, 10], [0, 0, 3.0, 5], [0, 0, 0, 1]])
        vertices, _ = label_mesh(sphere(), affine)
        centre = affine @ np.array([19.5, 19.5, 19.5, 1])
        self.assertTrue(np.allclose(vertices.mean(axis=0), centre[:3], atol=0.3))

    def test_faces_point_outwards(self):
        vertices, faces = label_mesh(sphere(), np.eye(4))
        tri = vertices[faces]
        normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        outward = np.einsum('ij,ij->i', normals, tri.mean(axis=1) - vertices.mean(axis=0))
        self.assertGreater((outward > 0).mean(), 0.98)

    def test_a_mirrored_grid_still_gets_outward_faces(self):
        affine = np.diag([-1.0, 1.0, 1.0, 1.0])  # mirrored: determinant < 0
        vertices, faces = label_mesh(sphere(), affine)
        tri = vertices[faces]
        normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        outward = np.einsum('ij,ij->i', normals, tri.mean(axis=1) - vertices.mean(axis=0))
        self.assertGreater((outward > 0).mean(), 0.98)

    def test_voxels_touching_only_along_an_edge_still_give_a_closed_surface(self):
        mask = np.zeros((6, 6, 6), bool)
        mask[2, 2, 2] = mask[3, 3, 2] = True  # diagonal neighbours in one plane
        mask[2, 2, 3] = mask[3, 3, 3] = True
        vertices, faces = label_mesh(mask, np.eye(4), smooth=False)
        edges = Counter(tuple(sorted(e)) for f in faces for e in ((f[0], f[1]), (f[1], f[2]), (f[2], f[0])))
        self.assertEqual(set(edges.values()), {2})

    def test_an_empty_label_gives_no_mesh(self):
        vertices, faces = label_mesh(np.zeros((10, 10, 10), bool), np.eye(4))
        self.assertEqual((len(vertices), len(faces)), (0, 0))

    def test_stl_round_trip(self):
        vertices, faces = label_mesh(sphere(radius=5, size=16), np.eye(4))
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'm.stl'
            write_stl(path, vertices, faces)
            data = path.read_bytes()
            self.assertEqual(struct.unpack('<I', data[80:84])[0], len(faces))
            self.assertEqual(len(data), 84 + 50 * len(faces))
            back = read_stl(path)
            self.assertTrue(np.allclose(back, vertices[faces], atol=1e-4))


if __name__ == '__main__':
    unittest.main()
