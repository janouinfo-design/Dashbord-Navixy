import { useState, useEffect, useRef } from "react";
import { API, api } from "@/lib/api";
import {
  Activity, Settings, Zap, Play, Square, Circle,
  ArrowRight, Plus, Save, Download, X, GripVertical
} from "lucide-react";

export const IoTTab = () => {
  const [flows, setFlows] = useState([]);
  const [currentFlow, setCurrentFlow] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [flowName, setFlowName] = useState("Default Flow");
  const [loading, setLoading] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const canvasRef = useRef(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggingNode, setDraggingNode] = useState(null);

  const nodeTypes = [
    { type: "data_source", label: "Source de donnees", icon: Activity, color: "blue" },
    { type: "output", label: "Point de sortie", icon: Square, color: "green" },
    { type: "attribute", label: "Attribut", icon: Settings, color: "purple" },
    { type: "logic", label: "Logique", icon: Zap, color: "yellow" },
    { type: "device_action", label: "Device action", icon: Play, color: "orange" },
    { type: "webhook", label: "Webhook", icon: ArrowRight, color: "red" },
  ];

  useEffect(() => {
    fetchFlows();
    setNodes([
      { id: "input-1", type: "data_source", label: "Default Input", position: { x: 100, y: 150 } },
      { id: "output-1", type: "output", label: "Default Output", position: { x: 500, y: 150 } }
    ]);
    setConnections([{ id: "conn-1", source_id: "input-1", target_id: "output-1" }]);
  }, []);

  const fetchFlows = async () => { try { const r = await api.get(`${API}/flows`); if (r.data.success) setFlows(r.data.flows); } catch (e) {} };

  const saveFlow = async () => {
    setLoading(true);
    try {
      const flowData = { name: flowName, nodes, connections };
      if (currentFlow) { await api.put(`${API}/flows/${currentFlow.id}`, flowData); } else { const r = await api.post(`${API}/flows`, flowData); setCurrentFlow(r.data.flow); }
      fetchFlows();
    } catch (e) {}
    setLoading(false);
  };

  const loadFlow = (flow) => { setCurrentFlow(flow); setFlowName(flow.name); setNodes(flow.nodes || []); setConnections(flow.connections || []); };
  const createNewFlow = () => { setCurrentFlow(null); setFlowName("Nouveau Flux"); setNodes([{ id: `input-${Date.now()}`, type: "data_source", label: "Default Input", position: { x: 100, y: 150 } }, { id: `output-${Date.now()}`, type: "output", label: "Default Output", position: { x: 500, y: 150 } }]); setConnections([]); };
  const addNodeAtPosition = (nodeType, x, y) => { const tc = nodeTypes.find(t => t.type === nodeType); setNodes([...nodes, { id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, type: nodeType, label: tc?.label || "New Node", position: { x, y } }]); };
  const deleteNode = (nodeId) => { setNodes(nodes.filter(n => n.id !== nodeId)); setConnections(connections.filter(c => c.source_id !== nodeId && c.target_id !== nodeId)); setSelectedNode(null); };

  const handleNodeMouseDown = (e, nodeId) => { e.stopPropagation(); const node = nodes.find(n => n.id === nodeId); if (!node || !canvasRef.current) return; const rect = canvasRef.current.getBoundingClientRect(); setDragOffset({ x: e.clientX - rect.left - node.position.x, y: e.clientY - rect.top - node.position.y }); setIsDragging(true); setDraggingNode(nodeId); setSelectedNode(nodeId); };
  const handleCanvasMouseMove = (e) => { if (!isDragging || !draggingNode || !canvasRef.current) return; const rect = canvasRef.current.getBoundingClientRect(); setNodes(nodes.map(n => n.id === draggingNode ? { ...n, position: { x: Math.max(0, e.clientX - rect.left - dragOffset.x), y: Math.max(0, e.clientY - rect.top - dragOffset.y) } } : n)); };
  const handleCanvasMouseUp = () => { setIsDragging(false); setDraggingNode(null); };

  const handleConnectorClick = (nodeId, isOutput) => { if (isOutput) { setConnectingFrom(nodeId); } else if (connectingFrom && connectingFrom !== nodeId) { if (!connections.some(c => c.source_id === connectingFrom && c.target_id === nodeId)) { setConnections([...connections, { id: `conn-${Date.now()}`, source_id: connectingFrom, target_id: nodeId }]); } setConnectingFrom(null); } };

  const getNodeColor = (type) => ({ data_source: "border-l-blue-500 bg-blue-50/50", output: "border-l-emerald-500 bg-emerald-50/50", attribute: "border-l-purple-500 bg-purple-50/50", logic: "border-l-amber-500 bg-amber-50/50", device_action: "border-l-orange-500 bg-orange-50/50", webhook: "border-l-red-500 bg-red-50/50" })[type] || "border-l-gray-500 bg-gray-50";
  const getNodeIcon = (type) => nodeTypes.find(t => t.type === type)?.icon || Circle;

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col" data-testid="iot-tab">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Flux</span>
          <select value={currentFlow?.id || ""} onChange={(e) => { const f = flows.find(f => f.id === e.target.value); if (f) loadFlow(f); }} className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"><option value="">Default</option>{flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          <input type="text" value={flowName} onChange={(e) => setFlowName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={createNewFlow} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111] text-white rounded-lg text-xs font-medium"><Plus size={14} /> Nouveau</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-52 bg-white border-r border-gray-200 p-4 overflow-y-auto flex-shrink-0">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-3">Noeuds</h4>
          <div className="space-y-1.5">
            {nodeTypes.map((nt) => (<div key={nt.type} draggable onDragStart={(e) => e.dataTransfer.setData('nodeType', nt.type)} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-grab text-xs"><GripVertical size={12} className="text-gray-300" /><nt.icon size={14} className="text-gray-500" /><span className="text-gray-700">{nt.label}</span></div>))}
          </div>
          <div className="mt-5 space-y-2">
            <button onClick={saveFlow} disabled={loading} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#111] text-white rounded-lg text-xs font-medium"><Save size={14} /> {loading ? "..." : "Enregistrer"}</button>
          </div>
        </div>

        <div ref={canvasRef} className="flex-1 bg-gray-50 relative overflow-hidden select-none" style={{ backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          onMouseDown={(e) => { if (e.target === canvasRef.current) { setSelectedNode(null); setConnectingFrom(null); } }}
          onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const nt = e.dataTransfer.getData('nodeType'); if (nt && canvasRef.current) { const rect = canvasRef.current.getBoundingClientRect(); addNodeAtPosition(nt, e.clientX - rect.left - 90, e.clientY - rect.top - 40); } }}>
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" /></marker></defs>
            {connections.map(conn => { const s = nodes.find(n => n.id === conn.source_id), t = nodes.find(n => n.id === conn.target_id); if (!s || !t) return null; const sx = s.position.x + 180, sy = s.position.y + 40, tx = t.position.x, ty = t.position.y + 40, mx = (sx + tx) / 2; return (<g key={conn.id} className="pointer-events-auto cursor-pointer" onClick={() => setConnections(connections.filter(c => c.id !== conn.id))}><path d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`} stroke="#d1d5db" strokeWidth="2" fill="none" markerEnd="url(#arrowhead)" className="hover:stroke-red-500" /></g>); })}
          </svg>
          {nodes.map(node => { const Icon = getNodeIcon(node.type); return (
            <div key={node.id} className={`absolute bg-white rounded-xl border-2 border-l-4 shadow-sm cursor-move select-none ${getNodeColor(node.type)} ${selectedNode === node.id ? 'ring-2 ring-gray-900 shadow-lg' : 'hover:shadow-md'}`}
              style={{ left: node.position.x, top: node.position.y, width: 180, minHeight: 70, zIndex: draggingNode === node.id ? 50 : 10 }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)} onClick={() => setSelectedNode(node.id)}>
              <div className={`absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 ${connectingFrom ? 'bg-blue-500 border-blue-600 animate-pulse' : 'bg-white border-gray-300'} flex items-center justify-center`} onClick={(e) => { e.stopPropagation(); handleConnectorClick(node.id, false); }}><div className="w-1.5 h-1.5 rounded-full bg-gray-400" /></div>
              <div className="p-3 flex items-center gap-2"><div className="p-1.5 bg-white rounded-lg shadow-sm border border-gray-100"><Icon size={14} className="text-gray-600" /></div><div className="flex-1 min-w-0"><input type="text" value={node.label} onChange={(e) => setNodes(nodes.map(n => n.id === node.id ? { ...n, label: e.target.value } : n))} className="text-xs font-medium text-gray-800 bg-transparent border-none focus:outline-none w-full" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} /><div className="text-[10px] text-gray-400 capitalize">{node.type.replace('_', ' ')}</div></div></div>
              <div className={`absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 ${connectingFrom === node.id ? 'bg-blue-500 border-blue-600' : 'bg-white border-gray-300'} flex items-center justify-center cursor-pointer`} onClick={(e) => { e.stopPropagation(); handleConnectorClick(node.id, true); }}><ArrowRight size={10} className="text-gray-400" /></div>
              {selectedNode === node.id && <button onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center justify-center shadow-md"><X size={12} /></button>}
            </div>
          ); })}
          {nodes.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-gray-400"><div className="text-center"><Zap size={40} className="mx-auto mb-2 opacity-30" /><p className="text-sm">Glissez-deposez des noeuds ici</p></div></div>}
        </div>
      </div>
    </div>
  );
};
