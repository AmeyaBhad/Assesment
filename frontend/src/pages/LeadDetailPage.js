import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { leadService } from '../services/lead.service';
import { useAuth } from '../context/AuthContext';
import { LEAD_STATUSES, getStatusColor, formatDateTime, getErrorMessage } from '../utils/constants';
import {
  ArrowLeft, Pencil, Trash2, User, Mail, Phone, Globe,
  Calendar, FileText, Activity, Loader
} from 'lucide-react';
import toast from 'react-hot-toast';

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="info-row">
    <Icon size={16} className="info-icon" />
    <div>
      <div className="info-label">{label}</div>
      <div className="info-value">{value || '—'}</div>
    </div>
  </div>
);

const ACTION_LABELS = {
  LEAD_CREATED: 'Lead Created',
  LEAD_UPDATED: 'Lead Updated',
  LEAD_ASSIGNED: 'Lead Assigned',
  STATUS_CHANGED: 'Status Changed',
  LEAD_DELETED: 'Lead Deleted',
};

const LeadDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();

  const [lead, setLead] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [leadData, activityData] = await Promise.all([
          leadService.getLeadById(id),
          leadService.getLeadActivity(id, { limit: 20 }),
        ]);
        setLead(leadData);
        setActivity(activityData.data || []);
      } catch (err) {
        toast.error(getErrorMessage(err));
        navigate('/leads');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  const handleDelete = async () => {
    if (!window.confirm(`Delete lead "${lead.name}"? This action cannot be undone.`)) return;
    setDeleting(true);
    try {
      await leadService.deleteLead(id);
      toast.success('Lead deleted');
      navigate('/leads');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleting(false);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!lead) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-left">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title">{lead.name}</h1>
            <span
              className="status-badge"
              style={{ background: getStatusColor(lead.status) + '22', color: getStatusColor(lead.status) }}
            >
              {lead.status}
            </span>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => navigate(`/leads/${id}/edit`)}>
            <Pencil size={15} /> Edit
          </button>
          {hasRole('admin', 'manager') && (
            <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader size={15} className="spin" /> : <Trash2 size={15} />} Delete
            </button>
          )}
        </div>
      </div>

      <div className="detail-grid">
        {/* Main Info */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><User size={16} /> Lead Information</h2>
          </div>
          <div className="card-body">
            <InfoRow icon={User} label="Full Name" value={lead.name} />
            <InfoRow icon={Mail} label="Email" value={lead.email} />
            <InfoRow icon={Phone} label="Phone" value={lead.phone} />
            <InfoRow icon={Globe} label="Source" value={lead.source} />
            <InfoRow icon={User} label="Assigned To" value={lead.assigned_to_name || 'Unassigned'} />
            <InfoRow icon={User} label="Created By" value={lead.created_by_name} />
            <InfoRow icon={Calendar} label="Created At" value={formatDateTime(lead.created_at)} />
            <InfoRow icon={Calendar} label="Updated At" value={formatDateTime(lead.updated_at)} />
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><FileText size={16} /> Notes</h2>
          </div>
          <div className="card-body">
            {lead.notes ? (
              <p className="notes-text">{lead.notes}</p>
            ) : (
              <p className="text-muted">No notes added.</p>
            )}
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="card full-width">
          <div className="card-header">
            <h2 className="card-title"><Activity size={16} /> Activity Timeline</h2>
          </div>
          <div className="card-body">
            {activity.length === 0 ? (
              <p className="text-muted">No activity recorded.</p>
            ) : (
              <div className="timeline">
                {activity.map((log) => (
                  <div key={log.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-action">
                        {ACTION_LABELS[log.action] || log.action}
                        {log.user_name && <span className="text-muted"> by {log.user_name}</span>}
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="timeline-details">
                          {log.action === 'STATUS_CHANGED'
                            ? `${log.details.from} → ${log.details.to}`
                            : JSON.stringify(log.details, null, 2)}
                        </div>
                      )}
                      <div className="timeline-time">{formatDateTime(log.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailPage;
