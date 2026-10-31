#!/usr/bin/env python3
"""Offline material placement check: same mesh classifications as studio.js, approximated with VTK.
This tests mesh/material assignments, not the browser interaction or native MTA renderer.
"""
from pathlib import Path
import numpy as np, trimesh, vtk
from vtk.util.numpy_support import numpy_to_vtk, numpy_to_vtkIdTypeArray

root=Path(__file__).resolve().parent
sc=trimesh.load(root/'assets/sultan_lspd_v10.glb',force='scene')
ren=vtk.vtkRenderer();ren.SetBackground(.14,.18,.22)
win=vtk.vtkRenderWindow();win.SetOffScreenRendering(True);win.SetSize(1100,680);win.AddRenderer(ren)
counts={'body':0,'doors':0,'wheel':0,'other':0,'hidden':0}
def paint(n):
    n=n.lower()
    try: idx=int(n.rsplit('_',1)[-1]);
    except ValueError: idx=-1
    if n.startswith(('lspd_door_','lspd_lightbar','lspd_bar_','lspd_hood','lspd_trunk')):return None,'hidden'
    if n.startswith('wheel_23_0'):return (.13,.14,.16),'wheel'
    if n.startswith('wheel_23_1'):return (.44,.46,.48),'wheel'
    if n.startswith(('door_lf_ok','door_rf_ok')):
        return ((.93,.92,.89),'doors') if idx in (1,2,4) else ((.06,.08,.09),'other')
    if n.startswith(('door_lr_ok','door_rr_ok')):
        return ((.93,.92,.89),'doors') if idx in (0,1,3) else ((.06,.08,.09),'other')
    if n.startswith(('bonnet_ok_1_0','boot_ok_3_0','sultan_roof','chassis_19_5','chassis_19_6','chassis_19_7','chassis_19_9','bump_front_ok_9_0','bump_rear_ok_11_0','bump_front_ok_9_1')):
        return (.035,.045,.05),'body'
    if n.startswith('windscreen'):return (.16,.22,.28),'other'
    return (.25,.28,.32),'other'
for node in sc.graph.nodes_geometry:
    transform,name=sc.graph[node]
    mesh=sc.geometry[name].copy()
    if len(mesh.faces)==0: continue
    color,kind=paint(name);counts[kind]+=1
    if color is None:continue
    mesh.apply_transform(transform)
    points=vtk.vtkPoints();points.SetData(numpy_to_vtk(np.asarray(mesh.vertices,dtype=np.float32),deep=True))
    poly=vtk.vtkPolyData();poly.SetPoints(points)
    f=np.asarray(mesh.faces,dtype=np.int64)
    cells=np.column_stack((np.full(len(f),3,dtype=np.int64),f)).ravel()
    cellarr=vtk.vtkCellArray();cellarr.SetCells(len(f),numpy_to_vtkIdTypeArray(cells,deep=True))
    poly.SetPolys(cellarr)
    mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly)
    actor=vtk.vtkActor();actor.SetMapper(mapper)
    prop=actor.GetProperty();prop.SetColor(*color);prop.SetAmbient(.43);prop.SetDiffuse(.57);prop.SetSpecular(.1)
    ren.AddActor(actor)
for view,pos,scale in [('kierowca',(-6.3,2.4,0),2.45),('3d',(-5.5,3.2,-5.5),2.75),('pasazer',(6.3,2.4,0),2.45)]:
    cam=ren.GetActiveCamera();cam.SetPosition(*pos);cam.SetFocalPoint(0,0,0);cam.SetViewUp(0,1,0);cam.ParallelProjectionOn();cam.SetParallelScale(scale);ren.ResetCameraClippingRange();win.Render()
    shot=vtk.vtkWindowToImageFilter();shot.SetInput(win);shot.ReadFrontBufferOff();shot.Update()
    out=root/f'preview-{view}.png';writer=vtk.vtkPNGWriter();writer.SetFileName(str(out));writer.SetInputConnection(shot.GetOutputPort());writer.Write()
print('rendered:',counts)
