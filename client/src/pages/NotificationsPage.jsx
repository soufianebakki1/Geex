import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { canAccessPath } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import { NOTIFICATIONS_CHANGED } from "../components/AppShell.jsx";
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Segmented } from "../components/ui.jsx";
import { formatDateTime, timeAgo } from "../utils/format.js";

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert };

export default function NotificationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const notifications = useAsync(() => api.notifications.list(), []);
  const [tab, setTab] = useState("unread");
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = useMemo(() => (notifications.data ?? []).filter((item) => !item.read).length, [notifications.data]);
  const rows = useMemo(() => (notifications.data ?? []).filter((item) => tab === "all" || !item.read), [notifications.data, tab]);

  const changed = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

  async function open(item) {
    if (!item.read) {
      notifications.setData((items) => items.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
      try {
        await api.notifications.markRead(item.id);
        changed();
      } catch (error) {
        toast.error(errorMessage(error));
      }
    }
    if (item.link && canAccessPath(user, item.link)) navigate(item.link);
  }

  async function markAll() {
    setMarkingAll(true);
    try {
      await api.notifications.markAllRead();
      notifications.setData((items) => items.map((entry) => ({ ...entry, read: true })));
      changed();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Compte"
        title="Notifications"
        description="Alertes sur les délais, validations et événements qui vous concernent."
        actions={
          unreadCount > 0 && (
            <Button icon={CheckCheck} onClick={markAll} loading={markingAll}>
              Tout marquer comme lu
            </Button>
          )
        }
      />

      <div className="toolbar">
        <Segmented
          label="Filtrer"
          value={tab}
          onChange={setTab}
          items={[
            { value: "unread", label: "Non lues", count: unreadCount },
            { value: "all", label: "Toutes", count: notifications.data?.length ?? 0 },
          ]}
        />
      </div>

      <Card flush>
        {notifications.loading && !notifications.data ? (
          <div className="card__body">
            <LoadingBlock />
          </div>
        ) : notifications.error && !notifications.data ? (
          <ErrorState error={notifications.error} onRetry={notifications.reload} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Bell} title={tab === "unread" ? "Vous êtes à jour" : "Aucune notification"} description={tab === "unread" ? "Aucune nouvelle alerte." : undefined} />
        ) : (
          <ul className="notif-list">
            {rows.map((item) => {
              const Icon = ICONS[item.type] ?? Info;
              return (
                <li key={item.id}>
                  <button type="button" className={`notif ${item.read ? "" : "is-unread"}`} onClick={() => open(item)}>
                    <span className={`notif__icon notif__icon--${item.type}`}>
                      <Icon size={17} />
                    </span>
                    <span className="grow">
                      <span className="notif__title">{item.title}</span>
                      <span className="notif__message">{item.message}</span>
                    </span>
                    <span className="notif__time" title={formatDateTime(item.at)}>
                      {timeAgo(item.at)}
                    </span>
                    {!item.read && <span className="notif__dot" aria-label="Non lue" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
