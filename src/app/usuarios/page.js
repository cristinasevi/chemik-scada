'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Plus, Edit, Trash2, Search, AlertTriangle, Bell, BellOff, X, Check } from 'lucide-react';
import { useUsers } from '../hooks/useUsers';

const UsersPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const {
        users,
        loading,
        error: usersError,
        createUser,
        updateUser,
        deleteUser,
        checkUsernameAvailable
    } = useUsers();

    const plants = useMemo(() => [
        { id: 'LAMAJA', name: 'La Maja' },
        { id: 'RETAMAR', name: 'Retamar' },
        { id: 'TOTAL', name: 'Todas las plantas' }
    ], []);

    const getPlantName = useCallback((plantId) => {
        const plant = plants.find(p => p.id === plantId);
        return plant ? plant.name : plantId;
    }, [plants]);

    const formatAssignedPlants = useCallback((plantasAsignadas) => {
        if (!plantasAsignadas || plantasAsignadas.length === 0) {
            return { display: 'Sin plantas', count: 0, list: [] };
        }

        if (plantasAsignadas.includes('TOTAL') ||
            (plantasAsignadas.includes('LAMAJA') && plantasAsignadas.includes('RETAMAR'))) {
            return {
                display: 'Todas las plantas',
                count: plantasAsignadas.length,
                list: ['Todas las plantas']
            };
        }

        const plantNames = plantasAsignadas.map(id => getPlantName(id));

        if (plantNames.length === 1) {
            return {
                display: plantNames[0],
                count: 1,
                list: plantNames
            };
        } else if (plantNames.length <= 3) {
            return {
                display: plantNames.join(', '),
                count: plantNames.length,
                list: plantNames
            };
        } else {
            return {
                display: `${plantNames[0]} y ${plantNames.length - 1} más`,
                count: plantNames.length,
                list: plantNames
            };
        }
    }, [plants]);

    const SuccessPopup = () => {
        if (!showSuccessPopup) return null;

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

    const showSuccess = useCallback((message) => {
        setSuccessMessage(message);
        setShowSuccessPopup(true);
        setTimeout(() => {
            setShowSuccessPopup(false);
        }, 3000);
    }, []);

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const matchesSearch = user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = filterRole === 'all' || user.rol === filterRole;

            return matchesSearch && matchesRole;
        });
    }, [users, searchTerm, filterRole]);

    const getRoleBadge = useCallback((role) => {
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
    }, []);

    const handleCreateUser = useCallback(() => {
        setSelectedUser(null);
        setShowCreateModal(true);
    }, []);

    const handleEditUser = useCallback((user) => {
        setSelectedUser(user);
        setShowEditModal(true);
    }, []);

    const handleDeleteUser = useCallback((user) => {
        setSelectedUser(user);
        setShowDeleteModal(true);
    }, []);

    const UserModal = ({ show, onClose, user, title, isDelete = false }) => {
        const [formData, setFormData] = useState({
            nombre: '',
            nombre_usuario: '',
            email: '',
            rol: 'cliente',
            notify_alarms: false,
            plantas_asignadas: [],
            password: ''
        });
        const [errors, setErrors] = useState({});
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [usernameChecking, setUsernameChecking] = useState(false);

        useEffect(() => {
            if (user) {
                setFormData({
                    nombre: user.nombre,
                    nombre_usuario: user.nombre_usuario,
                    email: user.email,
                    rol: user.rol,
                    notify_alarms: user.notify_alarms,
                    plantas_asignadas: user.plantas_asignadas || []
                });
            } else {
                setFormData({
                    nombre: '',
                    nombre_usuario: '',
                    email: '',
                    rol: 'cliente',
                    notify_alarms: false,
                    plantas_asignadas: [],
                    password: ''
                });
            }
            setErrors({});
        }, [user, show]);

        if (!show) return null;

        const validateForm = () => {
            const newErrors = {};

            if (!formData.nombre.trim()) {
                newErrors.nombre = 'El nombre es obligatorio';
            }

            const username = formData.nombre_usuario.trim();
            if (!username) {
                newErrors.nombre_usuario = 'El nombre de usuario es obligatorio';
            } else if (username !== formData.nombre_usuario) {
                newErrors.nombre_usuario = 'El nombre de usuario no debe tener espacios al inicio o final';
            }

            const email = formData.email.trim();
            if (!email) {
                newErrors.email = 'El email es obligatorio';
            } else if (email !== formData.email) {
                newErrors.email = 'El email no debe tener espacios al inicio o final';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                newErrors.email = 'El formato del email no es válido';
            }

            if (username && email && username !== email) {
                newErrors.emailMatch = 'El nombre de usuario y el email deben ser iguales';
            }

            if (!user && (!formData.password || formData.password.length < 6)) {
                newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
            }

            if (formData.plantas_asignadas.length === 0) {
                newErrors.plants = 'Debe asignar al menos una planta';
            }

            setErrors(newErrors);
            return Object.keys(newErrors).length === 0;
        };

        const handleSubmit = async (e) => {
            e.preventDefault();

            if (isDelete) {
                setIsSubmitting(true);
                try {
                    const result = await deleteUser(user.id);
                    if (result.success) {
                        onClose();
                        showSuccess(`Usuario "${user.nombre}" eliminado correctamente`);
                    } else {
                        setErrors({ submit: result.error });
                    }
                } catch (error) {
                    setErrors({ submit: 'Error eliminando usuario' });
                } finally {
                    setIsSubmitting(false);
                }
                return;
            }

            if (!validateForm()) {
                return;
            }

            setIsSubmitting(true);

            try {
                if (user) {
                    const result = await updateUser(user.id, formData);
                    if (result.success) {
                        onClose();
                        showSuccess(`Usuario "${formData.nombre}" actualizado correctamente`);
                    } else {
                        setErrors({ submit: result.error });
                    }
                } else {
                    const result = await createUser(formData);
                    if (result.success) {
                        onClose();
                        showSuccess(`Usuario "${formData.nombre}" creado correctamente`);
                    } else {
                        setErrors({ submit: result.error });
                    }
                }
            } catch (error) {
                console.error('Error al guardar usuario:', error);
                setErrors({ submit: 'Error al guardar usuario' });
            } finally {
                setIsSubmitting(false);
            }
        };

        const handleUsernameChange = async (value) => {
            setFormData({
                ...formData,
                nombre_usuario: value,
                email: value
            });

            if (value && value.length > 3 && value !== user?.nombre_usuario) {
                setUsernameChecking(true);
                try {
                    const result = await checkUsernameAvailable(value, user?.id);
                    if (!result.available && !result.error) {
                        setErrors(prev => ({
                            ...prev,
                            emailUnique: 'Ya existe un usuario con este email'
                        }));
                    } else {
                        setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors.emailUnique;
                            return newErrors;
                        });
                    }
                } catch (error) {
                    console.error('Error verificando username:', error);
                } finally {
                    setUsernameChecking(false);
                }
            }
        };

        const handleEmailChange = (value) => {
            setFormData({
                ...formData,
                email: value,
                nombre_usuario: value
            });
        };

        const addPlant = (plantId) => {
            if (plantId === 'TOTAL') {
                setFormData({
                    ...formData,
                    plantas_asignadas: ['TOTAL']
                });
            } else {
                let newPlants = formData.plantas_asignadas.filter(id => id !== 'TOTAL');

                if (!newPlants.includes(plantId)) {
                    newPlants.push(plantId);
                }

                setFormData({
                    ...formData,
                    plantas_asignadas: newPlants
                });
            }
        };

        const removePlant = (plantId) => {
            setFormData({
                ...formData,
                plantas_asignadas: formData.plantas_asignadas.filter(id => id !== plantId)
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
                            <div className="flex items-center gap-3 p-4 badge-red rounded-lg">
                                <AlertTriangle className="text-red-500" size={24} />
                                <div>
                                    <p className="font-medium text-red-error-primary">
                                        ¿Eliminar usuario?
                                    </p>
                                    <p className="text-sm text-red-error-secondary">
                                        Esta acción no se puede deshacer.
                                    </p>
                                </div>
                            </div>
                            <p className="text-secondary">
                                Se eliminará permanentemente el usuario <strong>{user?.nombre} </strong>
                                y todas sus configuraciones asociadas.
                            </p>
                            {errors.submit && (
                                <p className="text-red-500 text-sm">{errors.submit}</p>
                            )}
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
                            {errors.submit && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-red-700 dark:text-red-400 text-sm">{errors.submit}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-primary mb-1">
                                    Nombre completo *
                                </label>
                                <input
                                    type="text"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.nombre ? 'border-red-500' : 'border-custom'
                                        }`}
                                    disabled={isSubmitting}
                                />
                                {errors.nombre && (
                                    <p className="text-red-500 text-xs mt-1">{errors.nombre}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-primary mb-1">
                                    Email (será el nombre de usuario) *
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => handleUsernameChange(e.target.value)}
                                        className={`w-full px-3 py-2 border rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email || errors.emailMatch || errors.emailUnique ? 'border-red-500' : 'border-custom'
                                            }`}
                                        disabled={isSubmitting}
                                    />
                                    {usernameChecking && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>
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

                            {!user && (
                                <div>
                                    <label className="block text-sm font-medium text-primary mb-1">
                                        Contraseña *
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className={`w-full px-3 py-2 border rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.password ? 'border-red-500' : 'border-custom'
                                            }`}
                                        placeholder="Mínimo 6 caracteres"
                                        disabled={isSubmitting}
                                    />
                                    {errors.password && (
                                        <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-primary mb-1">
                                    Rol *
                                </label>
                                <select
                                    value={formData.rol}
                                    onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                                    className="w-full px-3 py-2 border border-custom rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isSubmitting}
                                >
                                    <option value="cliente">Cliente</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-primary mb-2">
                                    Plantas asignadas *
                                </label>

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
                                        .filter(plant => {
                                            if (formData.plantas_asignadas.includes('TOTAL')) {
                                                return false;
                                            }
                                            return !formData.plantas_asignadas.includes(plant.id);
                                        })
                                        .map(plant => (
                                            <option key={plant.id} value={plant.id}>
                                                {plant.name}
                                            </option>
                                        ))
                                    }
                                </select>

                                <div className="space-y-2">
                                    {formData.plantas_asignadas.map(plantId => {
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

                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-primary">Notificaciones</h3>

                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Bell size={16} className="text-secondary" />
                                        <span className="text-sm text-primary">Notificar alarmas</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, notify_alarms: !formData.notify_alarms })}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${formData.notify_alarms ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                                            }`}
                                        disabled={isSubmitting}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.notify_alarms ? 'translate-x-6' : 'translate-x-1'
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
                                    disabled={isSubmitting || errors.emailUnique}
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

    if (usersError) {
        return (
            <div className="w-full p-6 bg-panel rounded-lg">
                <div className="flex items-center justify-center h-32 text-red-500">
                    <AlertTriangle size={24} className="mr-2" />
                    <span>Error cargando usuarios: {usersError}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <SuccessPopup />

            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
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

                <button
                    onClick={handleCreateUser}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                    <Plus size={16} />
                    Nuevo Usuario
                </button>
            </div>

            <div className="bg-panel rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-header-table border-b border-custom">
                                <th className="text-left p-4 font-semibold text-primary text-sm">Nombre</th>
                                <th className="text-left p-4 font-semibold text-primary text-sm">Usuario</th>
                                <th className="text-left p-4 font-semibold text-primary text-sm">Email</th>
                                <th className="text-center p-4 font-semibold text-primary text-sm">Rol</th>
                                <th className="text-center p-4 font-semibold text-primary text-sm">Plantas</th>
                                <th className="text-center p-4 font-semibold text-primary text-sm">Notificar alarmas</th>
                                <th className="text-center p-4 font-semibold text-primary text-sm">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => {
                                const plantInfo = formatAssignedPlants(user.plantas_asignadas);

                                return (
                                    <tr key={user.id} className="border-b border-custom hover-bg">
                                        <td className="p-4">
                                            <div>
                                                <p className="font-medium text-primary">{user.nombre}</p>
                                            </div>
                                        </td>

                                        <td className="p-4">
                                            <div className="text-sm text-secondary">
                                                {user.nombre_usuario.split('@')[0]}
                                            </div>
                                        </td>

                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-sm text-secondary">
                                                {user.email}
                                            </div>
                                        </td>

                                        <td className="p-4 text-center">
                                            {getRoleBadge(user.rol)}
                                        </td>

                                        <td className="p-4 text-center">
                                            <div className="text-sm text-primary" title={plantInfo.list.join(', ')}>
                                                {plantInfo.display}
                                            </div>
                                            {plantInfo.count > 1 && (
                                                <div className="text-xs text-secondary mt-1">
                                                    {plantInfo.count} plantas
                                                </div>
                                            )}
                                        </td>

                                        <td className="p-4 text-center">
                                            <div className="flex justify-center">
                                                {user.notify_alarms ? (
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
                                );
                            })}
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
        </div>
    );
};

export default UsersPage;