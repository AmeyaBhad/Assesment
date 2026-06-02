import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { leadService } from '../services/lead.service';
import { useAuth } from '../context/AuthContext';
import { LEAD_STATUSES, LEAD_SOURCES, getStatusColor, formatDateTime, getErrorMessage } from '../utils/constants';
import {
  Plus, Search, Filter, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Eye, Pencil, Trash2, Loader
} from 'lucide-react';
import toast from 'react-hot-toast';

const LeadsPage = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [deleting, setDeleting] = useState(null);

  const fetchLeads = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        sortBy,
        sortOrder,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(sourceFilter && { source: sourceFilter }),
      };
      const res = await leadService.getLeads(params);
      setLeads(res.data || []);
      setPagination(res.pagination || { page, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sourceFilter, sortBy, sortOrder, pagination.limit]);

  useEffect(() => {
    const timer = setTimeout(() => fetchLeads(1), 300);
    return () => clearTimeout(timer);
  }, [fetchLeads]);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(col);
      setSortOrder('ASC');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete lead "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await leadService.deleteLead(id);
      toast.success('Lead deleted');
      fetchLeads(pagination.page);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <ChevronUp size={14} style={{ opacity: 0.3 }} />;
    return sortOrder === 'ASC' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">{pagination.total} total leads</p>
        </div>
        {hasRole('admin', 'manager') && (
          <button className="btn btn-primary" onClick={() => navigate('/leads/new')}>
            <Plus size={16} /> New Lead
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-group">
          <Filter size={14} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
            <option value="">All Status</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="filter-select">
            <option value="">All Sources</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div className="table-loading">
              <Loader size={24} className="spin" />
              <span>Loading leads...</span>
            </div>
          ) : leads.length === 0 ? (
            <div className="empty-state">
              <Search size={36} />
              <p>No leads found</p>
              {hasRole('admin', 'manager') && (
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/leads/new')}>
                  Create Lead
                </button>
              )}
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => handleSort('name')}>
                    Name <SortIcon col="name" />
                  </th>
                  <th>Contact</th>
                  <th className="sortable" onClick={() => handleSort('status')}>
                    Status <SortIcon col="status" />
                  </th>
                  <th className="sortable" onClick={() => handleSort('source')}>
                    Source <SortIcon col="source" />
                  </th>
                  <th>Assigned To</th>
                  <th className="sortable" onClick={() => handleSort('created_at')}>
                    Created <SortIcon col="created_at" />
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <div className="lead-name">{lead.name}</div>
                    </td>
                    <td>
                      <div className="text-sm">{lead.email || '—'}</div>
                      <div className="text-muted text-sm">{lead.phone || ''}</div>
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ background: getStatusColor(lead.status) + '22', color: getStatusColor(lead.status) }}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td>{lead.source || '—'}</td>
                    <td>{lead.assigned_to_name || <span className="text-muted">Unassigned</span>}</td>
                    <td className="text-muted text-sm">{formatDateTime(lead.created_at)}</td>
                    <td>
                      <div className="action-btns">
                        <button className="icon-btn" title="View" onClick={() => navigate(`/leads/${lead.id}`)}>
                          <Eye size={15} />
                        </button>
                        <button className="icon-btn" title="Edit" onClick={() => navigate(`/leads/${lead.id}/edit`)}>
                          <Pencil size={15} />
                        </button>
                        {hasRole('admin', 'manager') && (
                          <button
                            className="icon-btn danger"
                            title="Delete"
                            onClick={() => handleDelete(lead.id, lead.name)}
                            disabled={deleting === lead.id}
                          >
                            {deleting === lead.id ? <Loader size={15} className="spin" /> : <Trash2 size={15} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && pagination.totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="pagination-btns">
              <button
                className="btn btn-ghost btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchLeads(pagination.page - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    className={`btn btn-ghost btn-sm ${pagination.page === page ? 'active' : ''}`}
                    onClick={() => fetchLeads(page)}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                className="btn btn-ghost btn-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchLeads(pagination.page + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadsPage;
