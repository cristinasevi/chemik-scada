'use client';

import { useState, useEffect } from 'react';
import { User, Plus, Edit, Trash2, Search, AlertTriangle, Bell, BellOff, X, Check } from 'lucide-react';

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [plants, setPlants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showDropdown, setShowDropdown] = useState(null);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Lista de plantas disponibles
    const mockPlants = [
        { id: 'LAMAJA', name: 'LAMAJA' },
        { id: 'RETAMAR', name: 'RETAMAR' },
        { id: 'TOTAL', name: 'Todas las plantas' }
    ];

    // Componente del pop-up:
    const SuccessPopup = () => {
        if (!showSuccessPopup) return null;

        // Detectar modo oscuro
        const isDark = document.documentElement.classList.contains('dark');

        const popupStyles = {
            backgroundColor: isDark ? '#166534' : '#dcfce7',
            color: isDark ? '#bbf7d0' : '#166534',
            borderColor: isDark ? '#15803d' : '#bbf7d0'
        };

        const iconColor = isDark ? '#4ade80' : '#16a34a';

        return (
            <div className="fixed top-4 right-4 z-[60] animate-in slide-in-from-right duration-300">
                <div
                    className="px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 border"
                    style={popupStyles}
                >
                    <Check size={20} style={{ color: iconColor }} />
                    <span className="text-base">{successMessage}</span>
                    <button
                        onClick={() => setShowSuccessPopup(false)}
                        className="ml-2 rounded-full p-1 transition-colors cursor-pointer"
                        style={{
                            ':hover': {
                                backgroundColor: isDark ? '#15803d' : '#bbf7d0'
                            }
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.backgroundColor = isDark ? '#15803d' : '#bbf7d0';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.backgroundColor = 'transparent';
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        );
    };

    // Función para mostrar pop-up de éxito:
    const showSuccess = (message) => {
        setSuccessMessage(message);
        setShowSuccessPopup(true);
        setTimeout(() => {
            setShowSuccessPopup(false);
        }, 3000); // Se oculta después de 3 segundos
    };

    // Datos de ejemplo actualizados con los nuevos usuarios
    const mockUsers = [
        {
            id: 1,
            name: 'Admnistrador',
            username: 'admin@chemik.es',
            email: 'admin@chemik.es',
            role: 'admin',
            notifyAlarms: true,
            assignedPlants: ['LAMAJA', 'RETAMAR'],
            permissions: ['dashboard', 'users', 'plants', 'reports', 'settings'],
        },
        {
            id: 2,
            name: 'Rubén Santos',
            username: 'ruben.santos@chemik.es',
            email: 'ruben.santos@chemik.es',
            role: 'admin',
            notifyAlarms: true,
            assignedPlants: ['LAMAJA', 'RETAMAR'],
            permissions: ['dashboard', 'users', 'plants', 'reports', 'settings'],
        },
        {
            id: 3,
            name: 'Javi Gómez',
            username: 'jjgomez@chemik.es',
            email: 'jjgomez@chemik.es',
            role: 'admin',
            notifyAlarms: true,
            assignedPlants: ['LAMAJA', 'RETAMAR'],
            permissions: ['dashboard', 'users', 'plants', 'reports', 'settings'],
        },
        {
            id: 4,
            name: 'Óscar Ruiz',
            username: 'oscar.ruiz@chemik.es',
            email: 'oscar.ruiz@chemik.es',
            role: 'admin',
            notifyAlarms: true,
            assignedPlants: ['LAMAJA', 'RETAMAR'],
            permissions: ['dashboard', 'users', 'plants', 'reports', 'settings'],
        },
        {
            id: 5,
            name: 'Cliente',
            username: 'cliente@chemik.es',
            email: 'cliente@chemik.es',
            role: 'cliente',
            notifyAlarms: false,
            assignedPlants: ['LAMAJA', 'RETAMAR'],
            permissions: ['dashboard', 'plants', 'reports', 'settings'],
        },
    ];

    useEffect(() => {
        // Simular carga de datos
        setTimeout(() => {
            setUsers(mockUsers);
            setPlants(mockPlants);
            setLoading(false);
        }, 1000);
    }, []);

    // Filtrar usuarios
    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'all' || user.role === filterRole;

        return matchesSearch && matchesRole;
    });

    // Funciones de utilidad
    const getRoleBadge = (role) => {
        const roles = {
            admin: {
                label: 'Administrador',
                color: 'bg-badge'
            },
            cliente: {
                label: 'Cliente',
                color: 'bg-badge'
            },
        };

        const roleInfo = roles[role] || roles.cliente;
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${roleInfo.color}`}>
                {roleInfo.label}
            </span>
        );
    };

    const handleCreateUser = () => {
        setSelectedUser(null);
        setShowCreateModal(true);
    };

    const handleEditUser = (user) => {
        setSelectedUser(user);
        setShowEditModal(true);
        setShowDropdown(null);
    };

    const handleDeleteUser = (user) => {
        setSelectedUser(user);
        setShowDeleteModal(true);
        setShowDropdown(null);
    };

    const UserModal = ({ show, onClose, user, title, isDelete = false }) => {
        const [formData, setFormData] = useState({
            name: '',
            username: '',
            email: '',
            role: 'cliente',
            notifyAlarms: false,
            assignedPlants: []
        });
        const [errors, setErrors] = useState({});
        const [isSubmitting, setIsSubmitting] = useState(false);

        useEffect(() => {
            if (user) {
                setFormData(user);
            } else {
                setFormData({
                    name: '',
                    username: '',
                    email: '',
                    role: 'cliente',
                    notifyAlarms: false,
                    assignedPlants: []
                });
            }
            setErrors({});
        }, [user, show]);

        if (!show) return null;

        // Validaciones
        const validateForm = () => {
            const newErrors = {};

            // Validar nombre
            if (!formData.name.trim()) {
                newErrors.name = 'El nombre es obligatorio';
            }

            // Validar username (sin espacios al inicio/final)
            const username = formData.username.trim();
            if (!username) {
                newErrors.username = 'El nombre de usuario es obligatorio';
            } else if (username !== formData.username) {
                newErrors.username = 'El nombre de usuario no debe tener espacios al inicio o final';
            }

            // Validar email (sin espacios al inicio/final)
            const email = formData.email.trim();
            if (!email) {
                newErrors.email = 'El email es obligatorio';
            } else if (email !== formData.email) {
                newErrors.email = 'El email no debe tener espacios al inicio o final';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                newErrors.email = 'El formato del email no es válido';
            }

            // Validar que username y email sean iguales
            if (username && email && username !== email) {
                newErrors.emailMatch = 'El nombre de usuario y el email deben ser iguales';
            }

            // Validar que el email sea único
            const existingUser = users.find(u =>
                u.email === email && (!user || u.id !== user.id)
            );
            if (existingUser) {
                newErrors.emailUnique = 'Ya existe un usuario con este email';
            }

            // Validar plantas asignadas
            if (formData.assignedPlants.length === 0) {
                newErrors.plants = 'Debe asignar al menos una planta';
            }

            setErrors(newErrors);
            return Object.keys(newErrors).length === 0;
        };

        const handleSubmit = async (e) => {
            e.preventDefault();

            if (isDelete) {
                setIsSubmitting(true);
                setUsers(users.filter(u => u.id !== user.id));
                setIsSubmitting(false);
                onClose();
                showSuccess(`Usuario "${user.name}" eliminado correctamente`);
                return;
            }

            if (!validateForm()) {
                return;
            }

            setIsSubmitting(true);

            try {
                if (user) {
                    // Editar usuario existente
                    const updatedUser = { ...user, ...formData };
                    setUsers(users.map(u => u.id === user.id ? updatedUser : u));
                    showSuccess(`Usuario "${formData.name}" actualizado correctamente`);
                } else {
                    // Crear nuevo usuario
                    const newUser = {
                        ...formData,
                        id: Date.now(),
                        createdAt: new Date().toISOString(),
                        lastLogin: null,
                        permissions: formData.role === 'admin' ? ['dashboard', 'users', 'plants', 'reports', 'settings'] :
                            formData.role === 'cliente' ? ['dashboard', 'plants', 'reports'] :
                                ['dashboard']
                    };
                    setUsers([...users, newUser]);
                    showSuccess(`Usuario "${formData.name}" creado correctamente`);
                }

                onClose();
            } catch (error) {
                console.error('Error al guardar usuario:', error);
            } finally {
                setIsSubmitting(false);
            }
        };

        const handleUsernameChange = (value) => {
            setFormData({
                ...formData,
                username: value,
                email: value // Sincronizar email con username
            });
        };

        const handleEmailChange = (value) => {
            setFormData({
                ...formData,
                email: value,
                username: value // Sincronizar username con email
            });
        };

        const addPlant = (plantId) => {
            if (!formData.assignedPlants.includes(plantId)) {
                setFormData({
                    ...formData,
                    assignedPlants: [...formData.assignedPlants, plantId]
                });
            }
        };

        const removePlant = (plantId) => {
            setFormData({
                ...formData,
                assignedPlants: formData.assignedPlants.filter(id => id !== plantId)
            });
        };

        return (
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-panel rounded-lg p-6 w-full max-w-lg max-h-[95vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-primary">{title}</h2>
                        <button
                            onClick={onClose}
                            className="text-secondary hover:text-primary text-2xl leading-none"
                            disabled={isSubmitting}
                        >
                            <X className="w-5 h-5 cursor-pointer" />
                        </button>
                    </div>

                    {isDelete ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <AlertTriangle className="text-red-500" size={24} />
                                <div>
                                    <p className="font-medium text-red-800 dark:text-red-400">
                                        ¿Eliminar usuario?
                                    </p>
                                    <p className="text-sm text-red-600 dark:text-red-500">
                                        Esta acción no se puede deshacer.
                                    </p>
                                </div>
                            </div>
                            <p className="text-secondary">
                                Se eliminará permanentemente el usuario <strong>{user?.name} </strong>
                                y todas sus configuraciones asociadas.
                            </p>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border border-custom rounded-lg text-secondary hover-bg cursor-pointer"
                                    disabled={isSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 cursor-pointer"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Eliminando...' : 'Eliminar'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Nombre completo */}
                            <div>
                                <label className="block text-sm font-medium text-primary mb-1">
                                    Nombre completo *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-500' : 'border-custom'
                                        }`}
                                    disabled={isSubmitting}
                                />
                                {errors.name && (
                                    <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                                )}
                            </div>

                            {/* Email / Username */}
                            <div>
                                <label className="block text-sm font-medium text-primary mb-1">
                                    Email (será el nombre de usuario) *
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleEmailChange(e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email || errors.emailMatch || errors.emailUnique ? 'border-red-500' : 'border-custom'
                                        }`}
                                    disabled={isSubmitting}
                                />
                                {errors.email && (
                                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                                )}
                                {errors.emailMatch && (
                                    <p className="text-red-500 text-xs mt-1">{errors.emailMatch}</p>
                                )}
                                {errors.emailUnique && (
                                    <p className="text-red-500 text-xs mt-1">{errors.emailUnique}</p>
                                )}
                            </div>

                            {/* Rol */}
                            <div>
                                <label className="block text-sm font-medium text-primary mb-1">
                                    Rol *
                                </label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 border border-custom rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isSubmitting}
                                >
                                    <option value="cliente">Cliente</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            {/* Plantas asignadas */}
                            <div>
                                <label className="block text-sm font-medium text-primary mb-2">
                                    Plantas asignadas *
                                </label>

                                {/* Selector de plantas */}
                                <select
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            addPlant(e.target.value);
                                            e.target.value = '';
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-custom rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                                    disabled={isSubmitting}
                                >
                                    <option value="">Seleccionar planta...</option>
                                    {plants
                                        .filter(plant => !formData.assignedPlants.includes(plant.id))
                                        .map(plant => (
                                            <option key={plant.id} value={plant.id}>
                                                {plant.name}
                                            </option>
                                        ))
                                    }
                                </select>

                                {/* Lista de plantas asignadas */}
                                <div className="space-y-2">
                                    {formData.assignedPlants.map(plantId => {
                                        const plant = plants.find(p => p.id === plantId);
                                        return (
                                            <div key={plantId} className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-primary">
                                                        {plant?.name || plantId}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removePlant(plantId)}
                                                    className="text-red-500 hover:text-red-700 cursor-pointer"
                                                    disabled={isSubmitting}
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {errors.plants && (
                                    <p className="text-red-500 text-xs mt-1">{errors.plants}</p>
                                )}
                            </div>

                            {/* Notificar alarmas */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-primary">Notificaciones</h3>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Bell size={16} className="text-secondary" />
                                        <span className="text-sm text-primary">Notificar alarmas</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, notifyAlarms: !formData.notifyAlarms })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.notifyAlarms ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                                            }`}
                                        disabled={isSubmitting}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.notifyAlarms ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border border-custom rounded-lg text-secondary hover-bg disabled:opacity-50 cursor-pointer"
                                    disabled={isSubmitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ?
                                        (user ? 'Actualizando...' : 'Creando...') :
                                        (user ? 'Actualizar' : 'Crear')
                                    }
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="w-full p-6 bg-panel rounded-lg">
                <div className="flex items-center justify-center h-32 space-x-3">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-secondary">Cargando usuarios...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-primary">Gestión de Usuarios</h1>
                </div>
                <button
                    onClick={handleCreateUser}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                >
                    <Plus size={16} />
                    Nuevo Usuario
                </button>
            </div>

            {/* Pop-up de éxito */}
            <SuccessPopup />

            {/* Overlay para cerrar dropdowns */}
            {showDropdown && (
                <div
                    className="fixed inset-0 z-5"
                    onClick={() => setShowDropdown(null)}
                />
            )}

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-custom rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="w-40 px-3 py-2 border border-custom rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">Todos los roles</option>
                    <option value="admin">Administrador</option>
                    <option value="cliente">Cliente</option>
                </select>
            </div>

            {/* Tabla de usuarios */}
            <div className="bg-panel rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-header-table border-b border-custom">
                                <th className="text-left p-4 font-semibold text-primary text-sm">Nombre</th>
                                <th className="text-left p-4 font-semibold text-primary text-sm">Usuario</th>
                                <th className="text-left p-4 font-semibold text-primary text-sm">Email</th>
                                <th className="text-center p-4 font-semibold text-primary text-sm">Rol</th>
                                <th className="text-center p-4 font-semibold text-primary text-sm">Notificar alarmas</th>
                                <th className="text-center p-4 font-semibold text-primary text-sm">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="border-b border-custom hover-bg">
                                    <td className="p-4">
                                        <div>
                                            <p className="font-medium text-primary">{user.name}</p>
                                        </div>
                                    </td>

                                    <td className="p-4">
                                        <div className="text-sm text-secondary">
                                            {user.username.split('@')[0]}
                                        </div>
                                    </td>

                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-sm text-secondary">
                                            {user.email}
                                        </div>
                                    </td>

                                    <td className="p-4 text-center">
                                        {getRoleBadge(user.role)}
                                    </td>

                                    <td className="p-4 text-center">
                                        <div className="flex justify-center">
                                            {user.notifyAlarms ? (
                                                <Bell className="text-blue-500" size={16} />
                                            ) : (
                                                <BellOff className="text-gray-400" size={16} />
                                            )}
                                        </div>
                                    </td>

                                    <td className="p-4">
                                        <div className="flex justify-center gap-2">
                                            <button
                                                onClick={() => handleEditUser(user)}
                                                className="btn-edit-hover"
                                                title="Editar usuario"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user)}
                                                className="btn-delete-hover"
                                                title="Eliminar usuario"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredUsers.length === 0 && (
                    <div className="text-center py-8">
                        <User size={48} className="mx-auto text-secondary mb-2" />
                        <p className="text-secondary">No se encontraron usuarios</p>
                    </div>
                )}
            </div>

            {/* Modales */}
            <UserModal
                show={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Crear Usuario"
            />

            <UserModal
                show={showEditModal}
                onClose={() => setShowEditModal(false)}
                user={selectedUser}
                title="Editar Usuario"
            />

            <UserModal
                show={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                user={selectedUser}
                title="Eliminar Usuario"
                isDelete={true}
            />

            {/* Overlay para cerrar dropdowns */}
            {showDropdown && (
                <div
                    className="fixed inset-0 z-5"
                    onClick={() => setShowDropdown(null)}
                />
            )}
        </div>
    );
};

export default UsersPage;