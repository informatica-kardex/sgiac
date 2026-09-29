import { PermisoUsuario } from "../../api/types";
import { FUNCIONES_SUBADMIN, permisoVigente } from "../../utils/roles";

// Los campos muestran hora local del navegador; la API recibe instantes UTC.
function fechaLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function PermisosChecklist({ value, onChange, disabled }: {
  value: PermisoUsuario[]; onChange: (permisos: PermisoUsuario[]) => void; disabled: boolean;
}) {
  const actualizar = (modulo: string, cambios: Partial<PermisoUsuario>) =>
    onChange(value.map(p => p.modulo === modulo ? { ...p, ...cambios } : p));
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="mb-2 text-sm font-semibold">Funciones del subadministrador</legend>
    <p className="text-xs text-slate-500">Marca las funciones que podrá realizar. Desmárcalas para retirarlas. Puedes dejarlo sin funciones.</p>
    <p className="text-xs text-slate-500">Los periodos se cumplen una sola vez y se desactivan al finalizar. Zona horaria: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
    {Object.entries(FUNCIONES_SUBADMIN).map(([modulo, label]) => {
      const permiso = value.find(p => p.modulo === modulo);
      const temporal = permiso && (permiso.desde !== null || permiso.hasta !== null);
      return <div key={modulo} className="rounded-lg border border-slate-200 p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={Boolean(permiso)} onChange={e => onChange(e.target.checked ?
            [...value, { modulo, desde: null, hasta: null }] : value.filter(p => p.modulo !== modulo))} />{label}
        </label>
        {permiso && <div className="mt-3 space-y-3 pl-5">
          <label className="block text-xs">Vigencia<select className="input-field mt-1" value={temporal ? "periodo" : "siempre"} onChange={e => actualizar(modulo, e.target.value === "siempre" ?
            { desde: null, hasta: null } : { desde: new Date().toISOString(), hasta: new Date(Date.now() + 3600000).toISOString() })}>
            <option value="siempre">Sin límite de tiempo</option><option value="periodo">Desde / hasta</option>
          </select></label>
          {temporal && <div className="grid gap-3 sm:grid-cols-2">
            {(["desde", "hasta"] as const).map(campo => <label key={campo} className="block text-xs">{campo === "desde" ? "Desde" : "Hasta"}
              <input required type="datetime-local" className="input-field mt-1" value={fechaLocal(permiso[campo])}
                onChange={e => { if (e.target.validity.valid && e.target.value) actualizar(modulo, { [campo]: new Date(e.target.value).toISOString() }); }} />
            </label>)}
          </div>}
          {temporal && !permisoVigente(permiso) && <p className="text-xs text-amber-700">{permiso.hasta && Date.parse(permiso.hasta) <= Date.now() ? "Periodo vencido: sin acceso." : "El acceso se activará al inicio del periodo."}</p>}
        </div>}
      </div>;
    })}
  </fieldset>;
}
