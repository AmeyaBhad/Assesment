import React, { useState, useEffect } from 'react';
import { userService } from '../services/user.service';
import { formatDateTime, getErrorMessage } from '../utils/constants';
import { Activity, ChevronLeft, ChevronRight, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const ACTION_COLORS = {
  LEAD_CREATED: '#10b981',
  LEAD_UPDATED: '#3b82f6',
  LEAD_DELETED: '#ef4444',
  LEAD_ASSIGNED: '#f59e0b',
  STATUS_CHANGED: '#8b5cf6',
  USER_REGISTERED: '#06b6d4',
  USER_LOGIN: '#6b7280',
  USER_LOGOUT: '#6b7280',
};

const ACTION_LABELS = {
  LEAD_CREATED: '🟢 Lead Created',
  LEAD_UPDATED: '🔵 Lead Updated',
  LEAD_DELETED: '🔴 Lead Deleted',
  LEAD_ASSIGNED: '🟡 Lead Assigned',
  STATUS_CHANGED: '🟣 Status Changed',
  USER_REGISTERED: '🔵 User Registered',
  USER_LOGIN: '⬜ User Login',
  USER_LOGOUT: '⬜ User Logout',
};

const ActivityPage = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  const fetchActivity = async (page = 1) => {
    setLoading(true);
    try {
      const res = await userService.getActivityFeed({ page, limit: 20 });
      setLogs(res.data || []);
      setPagination(res.pagination || {});
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchActivity(1); }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity Feed</h1>
          <p className="page-subtitle">System-wide activity log</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title"><Activity size={18} /> All Activities ({pagination.total})</h2>
        </div>

        {loading ? (
          <div className="table-loading"><Loader size={24} className="spin" /><span>Loading...</span></div>
        ) : logs.length === 0 ? (
          <div className="empty-state"><Activity size={32} /><p>No activities yet</p></div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Lead</th>
                  <th>User</th>
                  <th>Details</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span style={{ color: ACTION_COLORS[log.action] || '#aaa', fontWeight: 600, fontSize: 13 }}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td>
                      {log.lead_name ? (
                        <button className="link-btn" onClick={() => log.lead_id && navigate(`/leads/${log.lead_id}`)}>
                          {log.lead_name}
                        </button>
                      ) : '—'}
                    </td>
                    <td>{log.user_name || '—'}</td>
                    <td>
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <span className="details-pill">
                          {log.action === 'STATUS_CHANGED'
                            ? `${log.details.from} → ${log.details.to}`
                            : Object.entries(log.details).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(', ')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-muted text-sm">{formatDateTime(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagination.totalPages > 1 && (
              <div className="pagination">
                <span className="pagination-info">Page {pagination.page} of {pagination.totalPages}</span>
                <div className="pagination-btns">
                  <button className="btn btn-ghost btn-sm" disabled={pagination.page <= 1} onClick={() => fetchActivity(pagination.page - 1)}>
                    <ChevronLeft size={16} />
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchActivity(pagination.page + 1)}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityPage;
