import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAsync } from "../hooks/useAsync.js";
import { useToast } from "./Toast.jsx";
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, FormError, LoadingBlock, Modal, PageHeader, SearchInput } from "./ui.jsx";

export default function CrudPage({ eyebrow, title, description, entityLabel, resource, columns, fields, searchKeys, canWrite, emptyIcon }) {
  const toast = useToast();
  const list = useAsync(() => resource.list(), []);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = list.data ?? [];
    if (!q) return items;
    return items.filter((item) => searchKeys.some((key) => String(item[key] ?? "").toLowerCase().includes(q)));
  }, [list.data, query, searchKeys]);

  function openForm(item) {
    setFormError(null);
    setEditing(item ?? {});
    setForm(Object.fromEntries(fields.map((field) => [field.name, item?.[field.name] ?? ""])));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
      if (editing.id) {
        const updated = await resource.update(editing.id, payload);
        list.setData((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        toast.success(`${entityLabel} mis à jour.`);
      } else {
        const created = await resource.create(payload);
        list.setData((items) => [...(items ?? []), created]);
        toast.success(`${entityLabel} ajouté.`);
      }
      setEditing(null);
    } catch (error) {
      setFormError(error);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await resource.remove(deleting.id);
      list.setData((items) => items.filter((item) => item.id !== deleting.id));
      toast.success(`${entityLabel} supprimé.`);
      setDeleting(null);
    } catch (error) {
      setDeleteError(error);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          canWrite && (
            <Button variant="primary" icon={Plus} onClick={() => openForm(null)}>
              Ajouter
            </Button>
          )
        }
      />

      <div className="toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder={`Rechercher un ${entityLabel.toLowerCase()}…`} />
        <span className="toolbar__spacer" />
        {list.data && (
          <span className="small muted">
            {rows.length} sur {list.data.length}
          </span>
        )}
      </div>

      <Card flush>
        {list.loading && !list.data ? (
          <div className="card__body">
            <LoadingBlock />
          </div>
        ) : list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={emptyIcon}
            title={query ? "Aucun résultat" : `Aucun ${entityLabel.toLowerCase()} enregistré`}
            description={query ? "Essayez avec un autre terme de recherche." : undefined}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className={column.align === "right" ? "align-right" : undefined}>
                      {column.label}
                    </th>
                  ))}
                  {canWrite && <th className="cell-actions">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    {columns.map((column) => (
                      <td key={column.key} className={column.align === "right" ? "align-right" : undefined}>
                        {column.render ? column.render(item) : item[column.key] || <span className="faint">—</span>}
                      </td>
                    ))}
                    {canWrite && (
                      <td className="cell-actions">
                        <div className="btn-group">
                          <Button size="sm" variant="ghost" iconOnly icon={Pencil} onClick={() => openForm(item)} aria-label={`Modifier ${item.name}`} title="Modifier" />
                          <Button
                            size="sm"
                            variant="danger-ghost"
                            iconOnly
                            icon={Trash2}
                            onClick={() => {
                              setDeleteError(null);
                              setDeleting(item);
                            }}
                            aria-label={`Supprimer ${item.name}`}
                            title="Supprimer"
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        busy={saving}
        title={editing?.id ? `Modifier — ${editing.name}` : `Nouveau ${entityLabel.toLowerCase()}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" form="crud-form" loading={saving}>
              Enregistrer
            </Button>
          </>
        }
      >
        <form id="crud-form" className="stack" onSubmit={save}>
          <div className="form-grid">
            {fields.map((field) => (
              <Field key={field.name} label={field.label} required={field.required} hint={field.hint} className={field.span ? "span-2" : ""}>
                {(id) =>
                  field.type === "textarea" ? (
                    <textarea id={id} className="textarea" value={form[field.name] ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, [field.name]: event.target.value }))} />
                  ) : (
                    <input
                      id={id}
                      className="input"
                      type={field.type ?? "text"}
                      required={field.required}
                      value={form[field.name] ?? ""}
                      placeholder={field.placeholder}
                      onChange={(event) => setForm((prev) => ({ ...prev, [field.name]: event.target.value }))}
                    />
                  )
                }
              </Field>
            ))}
          </div>
          <FormError error={formError} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Supprimer ${deleting?.name ?? ""} ?`}
        description="Cette action est définitive."
        confirmLabel="Supprimer"
        tone="danger"
        busy={deleteBusy}
        error={deleteError}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
