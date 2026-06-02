import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { leadService } from '../services/lead.service';
import { LEAD_STATUSES, LEAD_SOURCES, getErrorMessage } from '../utils/constants';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Save, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

const INITIAL_FORM = {
  name: '', email: '', phone: '', source: '', status: 'new', notes: '',
};

const LeadFormPage = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    if (isEdit) {
      leadService.getLeadById(id)
        .then((lead) => {
          setForm({
            name: lead.name || '',
            email: lead.email || '',
            phone: lead.phone || '',
            source: lead.source || '',
            status: lead.status || 'new',
            notes: lead.notes || '',
          });
        })
        .catch(() => {
          toast.error('Lead not found');
          navigate('/leads');
        })
        .finally(() => setFetching(false));
    }
  }, [id, isEdit, navigate]);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email';
    if (form.phone && !/^[+\d\s\-().]{7,20}$/.test(form.phone)) errs.phone = 'Enter a valid phone number';
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Agents can only update status/notes
    const payload = user.role === 'agent'
      ? { status: form.status, notes: form.notes }
      : { ...form };

    // Clean empty strings
    Object.keys(payload).forEach((k) => {
      if (payload[k] === '') payload[k] = undefined;
    });

    setLoading(true);
    try {
      if (isEdit) {
        await leadService.updateLead(id, payload);
        toast.success('Lead updated');
      } else {
        await leadService.createLead(payload);
        toast.success('Lead created and auto-assigned');
      }
      navigate('/leads');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="page-loading"><div className="spinner" /></div>;
  }

  const isAgent = user?.role === 'agent';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Lead' : 'New Lead'}</h1>
          <p className="page-subtitle">{isEdit ? 'Update lead information' : 'Create and auto-assign a lead'}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <div className="card form-card">
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="John Doe"
                className={errors.name ? 'error' : ''}
                disabled={isAgent}
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="john@example.com"
                className={errors.email ? 'error' : ''}
                disabled={isAgent}
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className={errors.phone ? 'error' : ''}
                disabled={isAgent}
              />
              {errors.phone && <span className="field-error">{errors.phone}</span>}
            </div>

            <div className="form-group">
              <label>Source</label>
              <select name="source" value={form.source} onChange={handleChange} disabled={isAgent}>
                <option value="">— Select Source —</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Status</label>
              <select name="status" value={form.status} onChange={handleChange}>
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Add any relevant notes..."
              rows={4}
            />
          </div>

          {!isEdit && (
            <div className="info-banner">
              <span>⚡ This lead will be automatically assigned to an available agent using least-loaded assignment logic.</span>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <Loader size={16} className="spin" /> : <Save size={16} />}
              {isEdit ? 'Update Lead' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeadFormPage;
