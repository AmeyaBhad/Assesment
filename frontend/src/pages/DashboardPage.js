import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/user.service';
import { leadService } from '../services/lead.service';
import { LEAD_STATUSES, formatDateTime, getStatusColor } from '../utils/constants';
import {
  Target, TrendingUp, Users, CheckCircle, XCircle, Clock,
  Plus, ArrowRight, Activity
} from 'lucide-react';
import toast from 'react-hot-toast';

const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: `${color}22`, color }}>
      <Icon size={22} />
    </div>
    <div className="stat-body">
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  </div>
);

const DashboardPage = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (hasRole('admin', 'manager')) {
          const [dashData, leadsData] = await Promise.all([
            userService.getDashboard(),
            leadService.getLeads({ limit: 5, sortBy: 'created_at', sortOrder: 'DESC' }),
          ]);
          setStats(dashData);
          setRecentLeads(leadsData.data || []);
        } else {
          const leadsData = await leadService.getLeads({ limit: 5, sortBy: 'created_at', sortOrder: 'DESC' });
          setRecentLeads(leadsData.data || []);
        }
      } catch {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [hasRole]);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  const s = stats?.summary;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, <strong>{user?.name}</strong></p>
        </div>
        {hasRole('admin', 'manager') && (
          <button className="btn btn-primary" onClick={() => navigate('/leads/new')}>
            <Plus size={16} /> New Lead
          </button>
        )}
      </div>

      {hasRole('admin', 'manager') && s && (
        <div className="stats-grid">
          <StatCard label="Total Leads" value={s.total_leads} icon={Target} color="#e94560" />
          <StatCard label="Active Leads" value={s.active_leads} icon={TrendingUp} color="#f59e0b" sub={`${s.new_leads} new`} />
          <StatCard label="Won" value={s.won_leads} icon={CheckCircle} color="#10b981" />
          <StatCard label="Lost" value={s.lost_leads} icon={XCircle} color="#ef4444" />
          <StatCard label="Agents" value={s.total_agents} icon={Users} color="#8b5cf6" />
          <StatCard label="This Week" value={s.leads_this_week} icon={Clock} color="#06b6d4" sub="new leads" />
        </div>
      )}

      <div className="dashboard-grid">
        {/* Recent Leads */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Target size={18} /> Recent Leads
            </h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/leads')}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          <div className="card-body">
            {recentLeads.length === 0 ? (
              <div className="empty-state">
                <Target size={32} />
                <p>No leads yet</p>
                {hasRole('admin', 'manager') && (
                  <button className="btn btn-primary btn-sm" onClick={() => navigate('/leads/new')}>
                    Create First Lead
                  </button>
                )}
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Assigned To</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((lead) => (
                    <tr key={lead.id} className="clickable" onClick={() => navigate(`/leads/${lead.id}`)}>
                      <td><strong>{lead.name}</strong></td>
                      <td>
                        <span className="status-badge" style={{ background: getStatusColor(lead.status) + '22', color: getStatusColor(lead.status) }}>
                          {lead.status}
                        </span>
                      </td>
                      <td>{lead.source || '—'}</td>
                      <td>{lead.assigned_to_name || 'Unassigned'}</td>
                      <td className="text-muted">{formatDateTime(lead.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Status breakdown */}
        {hasRole('admin', 'manager') && stats?.leadsByStatus?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                <Activity size={18} /> Pipeline Overview
              </h2>
            </div>
            <div className="card-body">
              <div className="pipeline-list">
                {LEAD_STATUSES.map(({ value, label, color }) => {
                  const found = stats.leadsByStatus.find((s) => s.status === value);
                  const count = found ? parseInt(found.count) : 0;
                  const max = Math.max(...stats.leadsByStatus.map((s) => parseInt(s.count)), 1);
                  return (
                    <div key={value} className="pipeline-item">
                      <span className="pipeline-label">{label}</span>
                      <div className="pipeline-bar-wrap">
                        <div className="pipeline-bar" style={{ width: `${(count / max) * 100}%`, background: color }} />
                      </div>
                      <span className="pipeline-count">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Agent performance */}
        {hasRole('admin', 'manager') && stats?.agentPerformance?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title"><Users size={18} /> Agent Performance</h2>
            </div>
            <div className="card-body">
              <table className="table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Total</th>
                    <th>Won</th>
                    <th>Lost</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.agentPerformance.map((a, i) => (
                    <tr key={i}>
                      <td>{a.name}</td>
                      <td>{a.total_leads}</td>
                      <td style={{ color: '#10b981' }}>{a.won_leads}</td>
                      <td style={{ color: '#ef4444' }}>{a.lost_leads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
