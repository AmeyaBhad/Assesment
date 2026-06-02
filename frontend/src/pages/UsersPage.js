import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../services/user.service';
import { getErrorMessage, formatDate } from '../utils/constants';
import { Plus, Search, Loader, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const ROLE_COLORS = {
  admin: { bg: '#e94560', text: '#fff' },
  manager: { bg: '#f59e0b', text: '#000' },
  agent: { bg: '#3b82f6', text: '#fff' },
};

const UsersPage = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await userService.getUsers({ page, limit: 20, role: roleFilter || undefined });
      setUsers(res.data || []);
      setPagination(res.pagination || {});
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => { fetchUsers(1); }, [fetchUsers]);

  const filtered = users.filter((u) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{pagination.total} total users</p>
        </div>
        {hasRole('admin') && (
          <button className="btn btn-primary" onClick={() => navigate('/users/create')}>
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      <div className="filters-bar">
        <div className="search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-group">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="filter-select">
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="agent">Agent</option>
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="table-loading"><Loader size={24} className="spin" /><span>Loading users...</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Search size={32} /><p>No users found</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                {hasRole('admin') && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const rc = ROLE_COLORS[u.role] || {};
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar sm">{u.name.charAt(0).toUpperCase()}</div>
                        <strong>{u.name}</strong>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="role-badge" style={{ background: rc.bg, color: rc.text }}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${u.is_active ? 'active' : 'inactive'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-muted">{formatDate(u.created_at)}</td>
                    {hasRole('admin') && (
                      <td>
                        <button className="icon-btn" title="Edit" onClick={() => navigate(`/users/${u.id}/edit`)}>
                          <Pencil size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default UsersPage;
