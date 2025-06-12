'use client';

import { useState, useEffect, useRef } from 'react';
import {
    ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Upload, Download, Trash2, Search,
    Plus, X, MoreVertical, SortAsc, SortDesc, Calendar, Tag, RefreshCw, AlertCircle, AlertTriangle, Pencil, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const GestionDocumentosPage = () => {
    const { user, isAdmin } = useAuth();

    const [documents, setDocuments] = useState([]);
    const [folders, setFolders] = useState([]);
    const [expandedFolders, setExpandedFolders] = useState(new Set(['root']));
    const [selectedFolder, setSelectedFolder] = useState('root');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [selectedDocuments, setSelectedDocuments] = useState(new Set());
    const [isUploading, setIsUploading] = useState(false);
    const [syncStatus, setSyncStatus] = useState({ syncing: false, message: '' });
    const [notifications, setNotifications] = useState([]);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null);
    const [showFolderMenu, setShowFolderMenu] = useState(null);
    const [editingFolder, setEditingFolder] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [creatingNewFolder, setCreatingNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const fileInputRef = useRef(null);

    // Sistema de notificaciones
    const showNotification = (message, type = 'success') => {
        const id = Date.now();
        const notification = { id, message, type };

        setNotifications(prev => [...prev, notification]);

        // Auto-remover después de 4 segundos
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 4000);
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    // Sistema de confirmación
    const showConfirm = (message, onConfirm) => {
        setConfirmAction({ message, onConfirm });
        setShowConfirmModal(true);
    };

    const handleConfirm = () => {
        if (confirmAction?.onConfirm) {
            confirmAction.onConfirm();
        }
        setShowConfirmModal(false);
        setConfirmAction(null);
    };

    const handleCancelConfirm = () => {
        setShowConfirmModal(false);
        setConfirmAction(null);
    };

    const handleBackgroundClick = (e) => {
        if (e.target === e.currentTarget) {
            setSelectedFolder('root');
        }
    };

    // Configurar listeners en tiempo real para Supabase
    useEffect(() => {
        let documentsSubscription;
        let foldersSubscription;

        const setupRealTimeListeners = async () => {
            try {
                documentsSubscription = supabase
                    .channel('documents_realtime_channel')
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'documents'
                    }, (payload) => {

                        if (payload.eventType === 'INSERT') {
                            setDocuments(prev => {
                                const exists = prev.some(doc => doc.id === payload.new.id);
                                if (!exists) {
                                    return [payload.new, ...prev];
                                }
                                return prev;
                            });
                            showNotification('Nuevo documento agregado', 'info');
                        } else if (payload.eventType === 'UPDATE') {
                            setDocuments(prev => prev.map(doc =>
                                doc.id === payload.new.id ? payload.new : doc
                            ));
                            showNotification('Documento actualizado', 'info');
                        } else if (payload.eventType === 'DELETE') {
                            setDocuments(prev => prev.filter(doc => doc.id !== payload.old.id));
                            showNotification('Documento eliminado', 'info');
                        }
                    })
                    .subscribe();

                foldersSubscription = supabase
                    .channel('folders_realtime_channel')
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'folders'
                    }, (payload) => {

                        if (payload.eventType === 'INSERT') {
                            setFolders(prev => {
                                const exists = prev.some(folder => folder.id === payload.new.id);
                                if (!exists) {
                                    return [...prev, payload.new];
                                }
                                return prev;
                            });
                            showNotification('Nueva carpeta creada', 'info');
                        } else if (payload.eventType === 'UPDATE') {
                            setFolders(prev => prev.map(folder =>
                                folder.id === payload.new.id ? payload.new : folder
                            ));
                            showNotification('Carpeta actualizada', 'info');
                        } else if (payload.eventType === 'DELETE') {
                            setFolders(prev => prev.filter(folder => folder.id !== payload.old.id));
                            showNotification('Carpeta eliminada', 'info');

                            // Si era la carpeta seleccionada, volver a root
                            setSelectedFolder(current => {
                                if (current === payload.old.id) {
                                    return 'root';
                                }
                                return current;
                            });

                            // Remover de carpetas expandidas
                            setExpandedFolders(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(payload.old.id);
                                return newSet;
                            });
                        }
                    })
                    .subscribe();

            } catch (error) {
                console.error('Error setting up real-time listeners:', error);
                // Continuar sin real-time si hay problemas
            }
        };

        setupRealTimeListeners();

        return () => {

            if (documentsSubscription) {
                supabase.removeChannel(documentsSubscription);
            }

            if (foldersSubscription) {
                supabase.removeChannel(foldersSubscription);
            }
        };
    }, []);

    const startCreatingFolder = () => {
        setCreatingNewFolder(true);
        setNewFolderName('');
    };

    const handleSaveNewFolder = async () => {
        if (!newFolderName.trim()) {
            showNotification('Ingresa un nombre para la carpeta', 'error');
            return;
        }

        setIsUploading(true);
        try {
            await createFolderInSupabase(newFolderName.trim(), selectedFolder);

            setCreatingNewFolder(false);
            setNewFolderName('');

            await refreshData(true);
            showNotification('Carpeta creada correctamente', 'success');
        } catch (error) {
            console.error('Error creating folder:', error);
            showNotification('Error al crear carpeta: ' + error.message, 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancelNewFolder = () => {
        setCreatingNewFolder(false);
        setNewFolderName('');
    };

    const isSystemFile = (fileName) => {
        const systemFiles = ['.emptyFolderPlaceholder', '.keep', '.gitkeep'];
        return systemFiles.includes(fileName);
    };

    // Función para sincronizar archivos Y CARPETAS huérfanos
    const syncAllFromStorage = async () => {
        try {
            setSyncStatus({ syncing: true, message: 'Sincronizando con Storage...' });

            // Limpiar datos existentes
            await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('folders').delete().neq('id', 'root');

            const allFiles = [];
            const allFolders = [];

            const processFolder = async (folderPath = '', parentFolderId = 'root', level = 0) => {
                const { data: files, error } = await supabase.storage
                    .from('documents')
                    .list(folderPath, { limit: 1000 });

                if (error) {
                    console.error(`Error listando ${folderPath}:`, error);
                    return;
                }

                for (const file of files) {
                    const fullPath = folderPath ? `${folderPath}/${file.name}` : file.name;

                    if (file.metadata && !isSystemFile(file.name)) {
                        // Es un archivo
                        allFiles.push({
                            name: file.name,
                            path: fullPath,
                            size: file.metadata.size,
                            lastModified: file.updated_at || file.created_at,
                            parentFolderId: parentFolderId
                        });
                    } else if (!file.metadata && !isSystemFile(file.name)) {
                        // Es una carpeta
                        const folderUniqueId = fullPath || file.name;

                        allFolders.push({
                            id: folderUniqueId,
                            name: file.name,
                            storagePath: fullPath,
                            parentId: parentFolderId,
                            lastModified: file.updated_at || file.created_at,
                            level: level + 1
                        });

                        // Procesar subcarpetas
                        await processFolder(fullPath, folderUniqueId, level + 1);
                    }
                }
            };

            await processFolder();

            // Insertar carpetas (ordenadas por nivel)
            allFolders.sort((a, b) => a.level - b.level);

            for (const folder of allFolders) {
                try {
                    let actualParentId = null;
                    if (folder.parentId !== 'root') {
                        actualParentId = folder.parentId;
                    }

                    const folderData = {
                        id: folder.id,
                        name: folder.name,
                        parent_id: actualParentId,
                        description: 'Sincronizado desde Storage',
                        category: '',
                        plant: '',
                        created_at: folder.lastModified || new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };

                    await supabase
                        .from('folders')
                        .insert([folderData]);
                } catch (error) {
                    console.error(`Error registrando carpeta ${folder.name}:`, error);
                }
            }

            // Insertar archivos
            for (const file of allFiles) {
                try {
                    const { data: { publicUrl } } = supabase.storage
                        .from('documents')
                        .getPublicUrl(file.path);

                    const pathParts = file.path.split('/');
                    let folder_id = 'root';

                    if (pathParts.length > 1) {
                        const folderPath = pathParts.slice(0, -1).join('/');
                        folder_id = folderPath;
                    }

                    const documentData = {
                        name: file.name,
                        original_name: file.name,
                        file_path: file.path,
                        file_url: publicUrl,
                        size: file.size || 0,
                        mime_type: getMimeTypeFromExtension(file.name),
                        folder_id: folder_id,
                        uploaded_by: 'Sistema (sincronizado)',
                        description: 'Sincronizado desde Storage',
                        tags: [],
                        category: '',
                        plant: '',
                        created_at: file.lastModified || new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };

                    await supabase
                        .from('documents')
                        .insert([documentData]);
                } catch (error) {
                    console.error(`Error registrando archivo ${file.name}:`, error);
                }
            }

            setSyncStatus({ syncing: false, message: '' });
            showNotification('Sincronización completada', 'success');

        } catch (error) {
            console.error('Error en sincronización:', error);
            setSyncStatus({ syncing: false, message: '' });
            showNotification('Error en sincronización: ' + error.message, 'error');
        }
    };

    const getMimeTypeFromExtension = (filename) => {
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'txt': 'text/plain',
            'csv': 'text/csv'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    };

    const loadFoldersFromSupabase = async () => {
        try {
            const { data, error } = await supabase
                .from('folders')
                .select('*')
                .order('name');

            if (error) throw error;

            if (!data || data.length === 0) {
                await createInitialStructure();
                return;
            }

            setFolders(data);
        } catch (error) {
            console.error('Error loading folders:', error);
            await createInitialStructure();
        }
    };

    const createInitialStructure = async () => {
        try {
            setFolders([]);
        } catch (error) {
            console.error('Error creating initial structure:', error);
            setFolders([]);
        }
    };

    const handleSaveRename = async (folder) => {
        if (!editingName.trim()) {
            showNotification('El nombre no puede estar vacío', 'error');
            return;
        }

        if (editingName.trim() === folder.name) {
            setEditingFolder(null);
            setEditingName('');
            return;
        }

        setIsUploading(true);
        try {
            const oldName = folder.name;
            const newName = editingName.trim();

            const oldStoragePath = getFolderStoragePath(folder.id);

            let newStoragePath = '';
            if (folder.parent_id) {
                const parentPath = getFolderStoragePath(folder.parent_id);
                newStoragePath = parentPath ? `${parentPath}/${newName}` : newName;
            } else {
                newStoragePath = newName;
            }

            const { data: allFiles, error: listError } = await supabase.storage
                .from('documents')
                .list(oldStoragePath, { limit: 1000 });

            if (listError && !listError.message.includes('not found')) {
                throw new Error(`Error listando archivos: ${listError.message}`);
            }

            const filesToMove = allFiles || [];

            if (filesToMove.length > 0) {
                for (const file of filesToMove) {
                    if (file.name === '.emptyFolderPlaceholder') continue;

                    const oldFilePath = oldStoragePath ? `${oldStoragePath}/${file.name}` : file.name;
                    const newFilePath = newStoragePath ? `${newStoragePath}/${file.name}` : file.name;

                    const { error: moveError } = await supabase.storage
                        .from('documents')
                        .move(oldFilePath, newFilePath);

                    if (moveError) {
                        console.warn(`Error moviendo ${file.name}:`, moveError);
                    }
                }
            }

            if (newStoragePath) {
                await createFolderInStorage(newStoragePath);
            }

            const { error: dbError } = await supabase
                .from('folders')
                .update({
                    name: newName,
                    updated_at: new Date().toISOString()
                })
                .eq('id', folder.id);

            if (dbError) throw dbError;

            if (filesToMove.length > 0) {
                for (const file of filesToMove) {
                    if (file.name === '.emptyFolderPlaceholder') continue;

                    const newFilePath = newStoragePath ? `${newStoragePath}/${file.name}` : file.name;

                    const { data: { publicUrl } } = supabase.storage
                        .from('documents')
                        .getPublicUrl(newFilePath);

                    await supabase
                        .from('documents')
                        .update({
                            file_path: newFilePath,
                            file_url: publicUrl,
                            updated_at: new Date().toISOString()
                        })
                        .eq('folder_id', folder.id);
                }
            }

            try {
                if (oldStoragePath) {
                    await supabase.storage
                        .from('documents')
                        .remove([`${oldStoragePath}/.emptyFolderPlaceholder`]);
                }
            } catch (cleanupError) {
                console.warn('Error limpiando carpeta anterior:', cleanupError);
            }

            setEditingFolder(null);
            setEditingName('');
            showNotification('Carpeta renombrada correctamente', 'success');

            await refreshData(true);

        } catch (error) {
            console.error('Error renaming folder:', error);
            showNotification('Error al renombrar carpeta: ' + error.message, 'error');

            await refreshData(true);

            setEditingFolder(null);
            setEditingName('');
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingFolder(null);
        setEditingName('');
    };

    const handleDeleteFolder = async (folder) => {
        try {
            // Verificar si la carpeta tiene archivos o subcarpetas
            const { data: subfolders } = await supabase
                .from('folders')
                .select('id')
                .eq('parent_id', folder.id);

            const { data: files } = await supabase
                .from('documents')
                .select('id')
                .eq('folder_id', folder.id);

            if (subfolders?.length > 0 || files?.length > 0) {
                showNotification('No se puede eliminar una carpeta que contiene archivos o subcarpetas', 'warning');
                return;
            }

            const { error } = await supabase
                .from('folders')
                .delete()
                .eq('id', folder.id);

            if (error) throw error;

            // También eliminar del storage si es necesario
            const folderPath = getFolderStoragePath(folder.id);
            if (folderPath) {
                await supabase.storage
                    .from('documents')
                    .remove([`${folderPath}/.emptyFolderPlaceholder`]);
            }

            await refreshData(true);

            showNotification('Carpeta eliminada correctamente', 'success');
        } catch (error) {
            console.error('Error deleting folder:', error);
            showNotification('Error al eliminar carpeta: ' + error.message, 'error');
        }
    };

    const startEditingFolder = (folder) => {
        setEditingFolder(folder.id);
        setEditingName(folder.name);
        setShowFolderMenu(null);
    };

    const confirmDeleteFolder = (folder) => {
        showConfirm(
            `¿Estás seguro de que deseas eliminar la carpeta "${folder.name}"? Esta acción no se puede deshacer.`,
            () => handleDeleteFolder(folder)
        );
        setShowFolderMenu(null);
    };

    const loadDocumentsFromSupabase = async () => {
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            setDocuments(data || []);
        } catch (error) {
            console.error('Error loading documents:', error);
            setDocuments([]);
        }
    };

    const createFolderInStorage = async (folderPath) => {
        try {
            // Sanitizar cada parte del path
            const sanitizedPath = folderPath
                .split('/')
                .map(part => sanitizeFolderName(part))
                .join('/');

            const placeholderFile = new Blob([''], { type: 'text/plain' });
            const placeholderPath = `${sanitizedPath}/.emptyFolderPlaceholder`;

            const { error } = await supabase.storage
                .from('documents')
                .upload(placeholderPath, placeholderFile);

            if (error && !error.message.includes('already exists')) {
                throw error;
            }
        } catch (error) {
            console.error('Error creating folder in storage:', error);
            throw error; // Re-lanzar el error para que sea manejado por quien llama
        }
    };

    const sanitizeFolderName = (name) => {
        return name
            .normalize('NFD') // Descomponer caracteres acentuados
            .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
            .replace(/ñ/g, 'n') // Reemplazar ñ por n
            .replace(/Ñ/g, 'N') // Reemplazar Ñ por N
            .replace(/[^a-zA-Z0-9\s\-_]/g, '') // Solo letras, números, espacios, guiones y guiones bajos
            .replace(/\s+/g, '_') // Reemplazar espacios por guiones bajos
            .trim(); // Eliminar espacios al inicio y final
    };

    const getFolderStoragePath = (folderId) => {
        if (folderId === 'root') return '';

        const folder = folders.find(f => f.id === folderId);
        if (!folder) return '';

        // Construir la ruta de forma iterativa y sanitizar cada parte
        const buildPath = (currentFolderId) => {
            const pathParts = [];
            let currentId = currentFolderId;

            while (currentId && currentId !== 'root') {
                const currentFolder = folders.find(f => f.id === currentId);
                if (!currentFolder) break;

                // Sanitizar el nombre de la carpeta para el storage
                pathParts.unshift(sanitizeFolderName(currentFolder.name));
                currentId = currentFolder.parent_id;
            }

            return pathParts.join('/');
        };

        return buildPath(folderId);
    };

    const uploadFileToSupabase = async (file, folderId = 'root') => {
        try {
            let fileName = file.name;
            let filePath;

            if (folderId === 'root') {
                filePath = fileName;
            } else {
                const folderPath = getFolderStoragePath(folderId);
                filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
            }

            const pathParts = filePath.split('/');
            const folderToCheck = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';

            const { data: existingFile } = await supabase.storage
                .from('documents')
                .list(folderToCheck, {
                    search: fileName
                });

            if (existingFile && existingFile.length > 0) {
                const fileExt = file.name.split('.').pop();
                const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
                fileName = `${nameWithoutExt}_${Date.now()}.${fileExt}`;

                if (folderId === 'root') {
                    filePath = fileName;
                } else {
                    const folderPath = getFolderStoragePath(folderId);
                    filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
                }
            }

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath);

            const documentData = {
                name: file.name,
                original_name: file.name,
                file_path: filePath,
                file_url: publicUrl,
                size: file.size,
                mime_type: file.type,
                folder_id: folderId,
                uploaded_by: user?.username || 'Anónimo',
                description: '',
                tags: [],
                category: '',
                plant: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data: documentRecord, error: dbError } = await supabase
                .from('documents')
                .insert([documentData])
                .select()
                .single();

            if (dbError) throw dbError;

            return documentRecord;
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    };

    const createFolderInSupabase = async (folderName, parentId = 'root') => {
        try {
            const folderId = crypto.randomUUID();

            const folderData = {
                id: folderId,
                name: folderName,
                parent_id: parentId === 'root' ? null : parentId,
                description: '',
                category: '',
                plant: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('folders')
                .insert([folderData])
                .select()
                .single();

            if (error) {
                throw error;
            }

            let folderStoragePath = '';

            if (parentId !== 'root') {
                const parentPath = getFolderStoragePath(parentId);
                folderStoragePath = parentPath ? `${parentPath}/${folderName}` : folderName;
            } else {
                folderStoragePath = folderName;
            }

            if (folderStoragePath) {
                await createFolderInStorage(folderStoragePath);
            }

            return data;
        } catch (error) {
            console.error('Error creating folder:', error);
            throw error;
        }
    };

    const handleDeleteDocument = async (document) => {
        try {
            // Eliminar archivo del storage
            const { error: storageError } = await supabase.storage
                .from('documents')
                .remove([document.file_path]);

            if (storageError) {
                console.warn('Error eliminando archivo del storage:', storageError);
            }

            // Eliminar registro de la base de datos
            const { error: dbError } = await supabase
                .from('documents')
                .delete()
                .eq('id', document.id);

            if (dbError) throw dbError;

            // Remover de seleccionados si estaba seleccionado
            setSelectedDocuments(prev => {
                const newSet = new Set(prev);
                newSet.delete(document.id);
                return newSet;
            });

            await refreshData(true);
            showNotification('Documento eliminado correctamente', 'success');
        } catch (error) {
            console.error('Error deleting document:', error);
            showNotification('Error al eliminar documento: ' + error.message, 'error');
        }
    };

    const confirmDeleteDocument = (document) => {
        showConfirm(
            `¿Estás seguro de que deseas eliminar el archivo "${document.name}"? Esta acción no se puede deshacer.`,
            () => handleDeleteDocument(document)
        );
    };

    const handleFileUpload = async (files) => {
        setIsUploading(true);
        try {
            const uploadPromises = Array.from(files).map(file =>
                uploadFileToSupabase(file, selectedFolder)
            );

            await Promise.all(uploadPromises);

            // Refresh automático después de la operación
            await refreshData(true);

            showNotification('Archivos subidos correctamente', 'success');
        } catch (error) {
            console.error('Error uploading files:', error);
            showNotification('Error al subir archivos: ' + error.message, 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const refreshData = async (silent = false) => {
        if (!silent) setLoading(true);

        try {
            await Promise.all([
                loadFoldersFromSupabase(),
                loadDocumentsFromSupabase()
            ]);

            if (!silent) {
                showNotification('Datos actualizados', 'success');
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
            if (!silent) {
                showNotification('Error al actualizar datos: ' + error.message, 'error');
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        const initializeData = async () => {
            setLoading(true);
            try {
                await loadFoldersFromSupabase();
                await loadDocumentsFromSupabase();
            } catch (error) {
                console.error('Error initializing data:', error);
                showNotification('Error al cargar datos: ' + error.message, 'error');
            } finally {
                setLoading(false);
            }
        };

        initializeData();
    }, []);

    const handleManualRefresh = async () => {
        await refreshData(false);
        await syncAllFromStorage();
    };

    useEffect(() => {
        const autoRefreshInterval = setInterval(() => {
            refreshData(true); // Silent refresh
        }, 60000);

        return () => {
            clearInterval(autoRefreshInterval);
        };
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                refreshData(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const handleDocumentSelection = (documentId, isSelected) => {
        setSelectedDocuments(prev => {
            const newSet = new Set(prev);
            if (isSelected) {
                newSet.add(documentId);
            } else {
                newSet.delete(documentId);
            }
            return newSet;
        });
    };

    const handleSelectAll = (isSelected) => {
        if (isSelected) {
            const allDocumentIds = new Set(sortedDocuments.map(doc => doc.id));
            setSelectedDocuments(allDocumentIds);
        } else {
            setSelectedDocuments(new Set());
        }
    };

    const downloadSelectedDocuments = async () => {
        const documentsToDownload = sortedDocuments.filter(doc => selectedDocuments.has(doc.id));

        if (documentsToDownload.length === 0) {
            showNotification('Selecciona al menos un archivo para descargar', 'warning');
            return;
        }

        // Si es solo un archivo, descarga normal
        if (documentsToDownload.length === 1) {
            handleDownload(documentsToDownload[0]);
        } else {
            // Si son múltiples archivos, crear ZIP
            await downloadAsZip(documentsToDownload);
        }

        setSelectedDocuments(new Set());
    };

    const downloadAsZip = async (documentsToDownload) => {
        try {
            // Importar JSZip dinámicamente
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();

            // Descargar todos los archivos y agregarlos al ZIP
            const downloadPromises = documentsToDownload.map(async (doc) => {
                try {
                    const response = await fetch(doc.file_url);
                    if (!response.ok) {
                        throw new Error(`Error descargando ${doc.name}`);
                    }
                    const blob = await response.blob();
                    zip.file(doc.original_name || doc.name, blob);
                } catch (error) {
                    console.error(`Error con archivo ${doc.name}:`, error);
                    // Continuar con otros archivos aunque uno falle
                }
            });

            await Promise.all(downloadPromises);

            // Generar el ZIP
            const zipBlob = await zip.generateAsync({ type: 'blob' });

            // Crear enlace de descarga para el ZIP
            const link = document.createElement('a');
            const url = URL.createObjectURL(zipBlob);
            link.href = url;

            // Nombre del archivo ZIP con fecha
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
            link.download = `documentos_${dateStr}.zip`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Limpiar URL object
            URL.revokeObjectURL(url);

            showNotification(`ZIP descargado con ${documentsToDownload.length} archivo(s)`, 'success');

        } catch (error) {
            console.error('Error creating ZIP:', error);
            showNotification('Error al crear el archivo ZIP: ' + error.message, 'error');
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const toggleFolder = (folderId) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
            } else {
                newSet.add(folderId);
            }
            return newSet;
        });
    };

    const selectFolder = (folderId) => {
        setSelectedFolder(folderId);
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            newSet.add(folderId);
            return newSet;
        });
    };

    const getFolderHierarchy = () => {
        const folderMap = new Map();
        const rootFolders = [];

        // Filtrar carpetas que NO sean root
        const regularFolders = folders.filter(folder => folder.id !== 'root');

        regularFolders.forEach(folder => {
            folderMap.set(folder.id, { ...folder, children: [] });
        });

        regularFolders.forEach(folder => {
            if (folder.parent_id === null || folder.parent_id === 'root') {
                rootFolders.push(folderMap.get(folder.id));
            } else {
                const parent = folderMap.get(folder.parent_id);
                if (parent) {
                    parent.children.push(folderMap.get(folder.id));
                }
            }
        });

        return rootFolders;
    };

    const getCurrentFolderDocuments = () => {
        return documents.filter(doc => {
            let matchesFolder = false;

            if (selectedFolder === 'root') {
                matchesFolder = doc.folder_id === 'root' || doc.folder_id === null;
            } else {
                matchesFolder = doc.folder_id === selectedFolder;
            }

            const matchesSearch = searchTerm === '' ||
                doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                doc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));

            return matchesFolder && matchesSearch;
        });
    };

    const sortedDocuments = [...getCurrentFolderDocuments()].sort((a, b) => {
        let aValue, bValue;

        switch (sortBy) {
            case 'name':
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
                break;
            case 'size':
                aValue = a.size;
                bValue = b.size;
                break;
            case 'date':
                aValue = new Date(a.created_at);
                bValue = new Date(b.created_at);
                break;
            default:
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
        }

        if (sortOrder === 'asc') {
            return aValue > bValue ? 1 : -1;
        } else {
            return aValue < bValue ? 1 : -1;
        }
    });

    const renderFolderTree = (folder, level = 0) => {
        const isExpanded = expandedFolders.has(folder.id);
        const isSelected = selectedFolder === folder.id;
        const hasChildren = folder.children && folder.children.length > 0;
        const isEditing = editingFolder === folder.id;

        return (
            <div key={folder.id}>
                <div
                    className={`group flex items-center gap-2 py-2 px-2 rounded cursor-pointer hover:bg-gray-100 transition-colors relative ${isSelected ? 'bg-blue-100 border-l-4 border-blue-500' : ''}`}
                    style={{ paddingLeft: `${level * 16 + 8}px` }}
                    onClick={!isEditing ? () => selectFolder(folder.id) : undefined}
                >
                    {hasChildren ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!isEditing) toggleFolder(folder.id);
                            }}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            disabled={isEditing}
                        >
                            {isExpanded ?
                                <ChevronDown size={14} className="text-gray-600" /> :
                                <ChevronRight size={14} className="text-gray-600" />
                            }
                        </button>
                    ) : (
                        <div className="w-6" />
                    )}

                    {isSelected && isExpanded ? (
                        <FolderOpen size={16} className="text-yellow-600" />
                    ) : (
                        <Folder size={16} className="text-yellow-600" />
                    )}

                    {isEditing ? (
                        <div className="flex items-center gap-2 flex-1">
                            <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSaveRename(folder);
                                    } else if (e.key === 'Escape') {
                                        handleCancelEdit();
                                    }
                                }}
                                className="flex-1 text-sm px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSaveRename(folder);
                                }}
                                className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors cursor-pointer"
                            >
                                <Check size={14} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelEdit();
                                }}
                                className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors cursor-pointer"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <span className={`text-sm truncate flex-1 ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                                {folder.name}
                            </span>

                            {/* Menú de tres puntos que aparece en hover */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowFolderMenu(showFolderMenu === folder.id ? null : folder.id);
                                    }}
                                    className="p-1 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                                >
                                    <MoreVertical size={14} className="text-gray-500" />
                                </button>

                                {/* Menú contextual */}
                                {showFolderMenu === folder.id && (
                                    <div className="absolute right-2 top-8 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1 min-w-[120px]">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                startEditingFolder(folder);
                                            }}
                                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                                        >
                                            <Pencil size={14} />
                                            Renombrar
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                confirmDeleteFolder(folder);
                                            }}
                                            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                                        >
                                            <Trash2 size={14} />
                                            Eliminar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {isExpanded && hasChildren && (
                    <div className="ml-2">
                        {folder.children
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(child => renderFolderTree(child, level + 1))
                        }
                    </div>
                )}
            </div>
        );
    };

    const handleDirectFileUpload = async (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            await handleFileUpload(files);
        }
        // Limpiar el input para poder seleccionar los mismos archivos otra vez
        e.target.value = '';
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showFolderMenu) {
                setShowFolderMenu(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showFolderMenu]);

    const getBreadcrumb = (folderId) => {
        if (folderId === 'root') return 'PLANTAS';

        const folder = folders.find(f => f.id === folderId);
        if (!folder) return 'PLANTAS';

        const buildPath = (currentFolder) => {
            if (!currentFolder || currentFolder.parent_id === null || currentFolder.parent_id === 'root') {
                return currentFolder ? [currentFolder.name] : [];
            }

            const parent = folders.find(f => f.id === currentFolder.parent_id);
            return [...buildPath(parent), currentFolder.name];
        };

        const path = buildPath(folder);
        return 'PLANTAS > ' + path.join(' > ');
    };

    const handleDownload = async (doc) => {
        try {

            // Fetch del archivo para forzar la descarga
            const response = await fetch(doc.file_url, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                },
            });

            if (!response.ok) {
                throw new Error(`Error al descargar: ${response.status}`);
            }

            // Convertir a blob
            const blob = await response.blob();

            // Crear URL del blob
            const blobUrl = URL.createObjectURL(blob);

            // Crear enlace de descarga
            const link = document.createElement('a');
            link.href = blobUrl;

            // Usar el nombre original o el nombre del documento
            const filename = doc.original_name || doc.name || 'archivo_descargado';
            link.download = filename;

            // Configurar atributos para forzar descarga
            link.style.display = 'none';
            link.target = '_blank';

            // Agregar al DOM, hacer clic y remover
            document.body.appendChild(link);
            link.click();

            // Limpiar después de un momento
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl); // Liberar memoria
            }, 100);

            // Mostrar notificación de éxito
            showNotification(`Archivo "${filename}" descargado correctamente`, 'success');

        } catch (error) {
            console.error('Error downloading file:', error);
            showNotification('Error al descargar el archivo: ' + error.message, 'error');
        } finally {
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-gray-500 text-sm">Cargando documentos...</p>
                </div>
            </div>
        );
    }

    const folderHierarchy = getFolderHierarchy();

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Toolbar superior */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar documentos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 w-64 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={handleManualRefresh}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover-bg-blue rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Contenido principal */}
            <div className="flex flex-1 overflow-hidden">
                {/* Panel izquierdo - Árbol de carpetas */}
                <div
                    className="w-80 border-r border-gray-200 bg-white overflow-y-auto"
                    onClick={handleBackgroundClick}
                >
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <Folder size={16} className="text-yellow-600" />
                                {folders.find(f => f.id === 'root')?.name || 'PLANTAS'}
                            </div>
                            <button
                                onClick={startCreatingFolder}
                                disabled={creatingNewFolder}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover-bg-blue rounded-md transition-colors cursor-pointer disabled:opacity-50"
                                title="Crear nueva carpeta"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="space-y-1">
                            {folderHierarchy.map(folder => (
                                <div key={folder.id} className="group">
                                    {renderFolderTree(folder)}
                                </div>
                            ))}

                            {/* Input inline para crear nueva carpeta */}
                            {creatingNewFolder && (
                                <div
                                    className="flex items-center gap-2 py-2 px-2 rounded bg-blue-50 border border-blue-200"
                                    style={{ paddingLeft: '8px' }}
                                >
                                    <div className="w-6" />
                                    <Folder size={16} className="text-blue-600" />
                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            type="text"
                                            value={newFolderName}
                                            onChange={(e) => setNewFolderName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleSaveNewFolder();
                                                } else if (e.key === 'Escape') {
                                                    handleCancelNewFolder();
                                                }
                                            }}
                                            placeholder="Nombre de la carpeta"
                                            className="flex-1 text-sm px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            autoFocus
                                            disabled={isUploading}
                                        />
                                        <button
                                            onClick={handleSaveNewFolder}
                                            disabled={isUploading || !newFolderName.trim()}
                                            className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            {isUploading ? (
                                                <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <Check size={14} />
                                            )}
                                        </button>
                                        <button
                                            onClick={handleCancelNewFolder}
                                            disabled={isUploading}
                                            className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Panel derecho - Lista de archivos */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Breadcrumb y controles */}
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="text-sm text-gray-600 font-medium">
                                    {getBreadcrumb(selectedFolder)}
                                </div>
                                <div className="text-xs text-gray-400">
                                    ({sortedDocuments.length} archivo{sortedDocuments.length !== 1 ? 's' : ''})
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-gray-600">Ordenar por:</label>
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value)}
                                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="name">Nombre</option>
                                        <option value="date">Fecha</option>
                                        <option value="size">Tamaño</option>
                                    </select>
                                    <button
                                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                        className="p-1 text-gray-600 hover:text-gray-800 transition-colors cursor-pointer"
                                        title={`Orden ${sortOrder === 'asc' ? 'ascendente' : 'descendente'}`}
                                    >
                                        {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Lista de archivos */}
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                <tr>
                                    <th className="text-left p-3 font-medium text-gray-700 text-sm w-12">
                                        <input
                                            type="checkbox"
                                            checked={sortedDocuments.length > 0 && selectedDocuments.size === sortedDocuments.length}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                    <th className="text-left p-3 font-medium text-gray-700 text-sm">Nombre</th>
                                    <th className="text-left p-3 font-medium text-gray-700 text-sm">Tamaño</th>
                                    <th className="text-center p-3 font-medium text-gray-700 text-sm">Fecha de modificación</th>
                                    <th className="text-center p-3 font-medium text-gray-700 text-sm">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedDocuments.map(document => (
                                    <tr key={document.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedDocuments.has(document.id)}
                                                onChange={(e) => handleDocumentSelection(document.id, e.target.checked)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                <FileText className="text-blue-500 flex-shrink-0" size={20} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-gray-900 truncate">{document.name}</span>
                                                    </div>
                                                    {document.tags && document.tags.length > 0 && (
                                                        <div className="flex gap-1 mt-1">
                                                            {document.tags.slice(0, 3).map(tag => (
                                                                <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                                                    <Tag size={8} />
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                            {document.tags.length > 3 && (
                                                                <span className="text-xs text-gray-400">
                                                                    +{document.tags.length - 3} más
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-3 text-gray-600 text-sm">
                                            {formatFileSize(document.size)}
                                        </td>
                                        <td className="p-3 text-gray-600 text-sm">
                                            <div className="flex items-center justify-center gap-1">
                                                <Calendar size={12} />
                                                {formatDate(document.created_at)}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => handleDownload(document)}
                                                    className="p-2 text-blue-600 hover-bg-blue rounded-md transition-colors cursor-pointer"
                                                    title="Descargar"
                                                >
                                                    <Download size={14} />
                                                </button>
                                                <button
                                                    onClick={() => confirmDeleteDocument(document)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {sortedDocuments.length === 0 && (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-center">
                                    <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">Sin documentos</h3>
                                    <p className="text-gray-500 mb-4">
                                        {searchTerm ? 'No se encontraron documentos que coincidan con la búsqueda' : 'Esta carpeta está vacía'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Botones flotantes */}
            <div className="fixed bottom-6 right-6 flex gap-3 z-40">
                {/* Botón de descargar - a la izquierda */}
                {selectedDocuments.size > 0 && (
                    <button
                        onClick={downloadSelectedDocuments}
                        className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-all duration-200 hover:scale-105 cursor-pointer"
                        title={`Descargar ${selectedDocuments.size} archivo(s) seleccionado(s)`}
                    >
                        <Download size={20} />
                        <span className="hidden sm:block">
                            Descargar ({selectedDocuments.size})
                        </span>
                    </button>
                )}

                {/* Botón de subir - a la derecha */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 hover:scale-105 disabled:opacity-50 cursor-pointer"
                    title="Subir archivos"
                >
                    <Upload size={20} />
                    <span className="hidden sm:block">
                        {isUploading ? 'Subiendo...' : 'Subir'}
                    </span>
                    {isUploading && (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    )}
                </button>
            </div>

            {/* Input file oculto */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleDirectFileUpload}
                className="hidden"
                accept="*/*"
            />

            {/* Sistema de notificaciones */}
            <div className="fixed top-4 right-4 z-50 space-y-3">
                {notifications.map(notification => (
                    <div
                        key={notification.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out max-w-sm ${notification.type === 'success' ? 'bg-green-600 text-white' :
                            notification.type === 'error' ? 'bg-red-600 text-white' :
                                notification.type === 'warning' ? 'bg-yellow-600 text-white' :
                                    'bg-blue-600 text-white'
                            }`}
                    >
                        {notification.type === 'success' && <Check size={20} />}
                        {notification.type === 'error' && <X size={20} />}
                        {notification.type === 'warning' && <AlertTriangle size={20} />}
                        {notification.type === 'info' && <AlertCircle size={20} />}

                        <span className="flex-1 text-sm font-medium">{notification.message}</span>

                        <button
                            onClick={() => removeNotification(notification.id)}
                            className="p-1 hover:bg-white/20 rounded transition-colors cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Modal de confirmación */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
                        <div className="p-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                    <AlertTriangle className="text-red-600" size={24} />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Confirmar eliminación</h3>
                            </div>

                            <p className="text-gray-600 mb-6 leading-relaxed break-words">
                                {confirmAction?.message}
                            </p>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={handleCancelConfirm}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors cursor-pointer"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestionDocumentosPage;