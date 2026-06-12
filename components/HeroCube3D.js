'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function HeroCube3D() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd6e8ee);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(5.5, 4.5, 5.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight1.position.set(5, 10, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x97cadb, 0.4);
    dirLight2.position.set(-5, -5, -5);
    scene.add(dirLight2);

    const pivotGroup = new THREE.Group();
    scene.add(pivotGroup);

    const layers = {
      '-1': new THREE.Group(),
      '0': new THREE.Group(),
      '1': new THREE.Group(),
    };
    pivotGroup.add(layers['-1']);
    pivotGroup.add(layers['0']);
    pivotGroup.add(layers['1']);

    const layerColors = {
      '-1': 0x97cadb,
      '0': 0x018abe,
      '1': 0xffdd53,
    };

    const cubes = [];
    const size = 0.85;
    const gap = 1.05;

    for (let x = -1; x <= 1; x += 1) {
      for (let y = -1; y <= 1; y += 1) {
        for (let z = -1; z <= 1; z += 1) {
          if (x === 0 && y === 0 && z === 0) continue;

          const geometry = new THREE.BoxGeometry(size, size, size);
          const material = new THREE.MeshLambertMaterial({
            color: layerColors[y.toString()],
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(x * gap, y * gap, z * gap);

          const edges = new THREE.EdgesGeometry(geometry);
          const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x000000 })
          );
          mesh.add(line);

          mesh.userData = {
            originalScale: new THREE.Vector3(1, 1, 1),
          };

          layers[y.toString()].add(mesh);
          cubes.push(mesh);
        }
      }
    }

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let animationFrameId;

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onMouseMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(pivotGroup.children, true);

      cubes.forEach((cube) => {
        cube.scale.lerp(cube.userData.originalScale, 0.15);
        cube.material.emissive.setHex(0x000000);
      });

      if (intersects.length > 0) {
        const targetMesh = intersects[0].object;
        if (targetMesh.type === 'Mesh') {
          targetMesh.scale.lerp(new THREE.Vector3(1.2, 1.2, 1.2), 0.2);
          targetMesh.material.emissive.setHex(0x222222);
        }
      }

      if (isDragging) {
        const deltaMove = {
          x: e.clientX - previousMousePosition.x,
          y: e.clientY - previousMousePosition.y,
        };
        const q = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(deltaMove.y * 0.007, deltaMove.x * 0.007, 0, 'XYZ')
        );
        pivotGroup.quaternion.multiplyQuaternions(q, pivotGroup.quaternion);
      }

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e) => {
      if (isDragging && e.touches.length === 1) {
        const deltaMove = {
          x: e.touches[0].clientX - previousMousePosition.x,
          y: e.touches[0].clientY - previousMousePosition.y,
        };
        const q = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(deltaMove.y * 0.008, deltaMove.x * 0.008, 0, 'XYZ')
        );
        pivotGroup.quaternion.multiplyQuaternions(q, pivotGroup.quaternion);
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd);
    window.addEventListener('resize', onResize);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!reducedMotion) {
        if (!isDragging) {
          pivotGroup.rotation.y += 0.002;
          pivotGroup.rotation.x += 0.001;
        }
        layers['-1'].rotation.y += 0.003;
        layers['0'].rotation.y -= 0.004;
        layers['1'].rotation.y += 0.006;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);

      cubes.forEach((cube) => {
        cube.geometry.dispose();
        cube.material.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="hero-cube-wrap" data-aos="fade-up">
      <div id="canvas3d-wrapper" className="hero-cube-canvas" ref={containerRef} />
      <p className="hero-cube-caption">Kéo để xoay — 3 lớp = 30% / 50% / 20%</p>
    </div>
  );
}
