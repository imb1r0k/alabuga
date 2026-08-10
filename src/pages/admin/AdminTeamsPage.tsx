import React, { useState, useEffect, useMemo } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { AdminLayout } from '../../components/AdminLayout';
import { useToast } from '../../components/Toast';
import {
  getAdminTeams,
  saveAdminTeam,
  deleteAdminTeam,
  getAdminTeamMembers,
  addAdminTeamMember,
  removeAdminTeamMember,
  getAdminUsers,
  getAdminTeamChat,
  sendAdminTeamMessage,
  clearAdminTeamChat,
  deleteAdminTeamMessage,
  getAdminTeamCalendar,
  addAdminTeamEvent,
  deleteAdminTeamEvent,
} from '../../services/api';
import { Users, MessageSquare, Calendar, Trash2, Plus, Save, UserPlus, UserMinus, Eraser, ShieldCheck, Search, Image as ImageIcon, X } from 'lucide-react';

export const AdminTeamsPage: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Добавление участников
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Данные выбранной команды
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventImageUrl, setNewEventImageUrl] = useState('');
  const [newEventImageFile, setNewEventImageFile] = useState<File | null>(null);

  const { showToast } = useToast();