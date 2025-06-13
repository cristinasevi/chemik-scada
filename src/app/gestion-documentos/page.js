'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Upload, Download, Trash2, Search, Move,
    Plus, X, MoreVertical, SortAsc, SortDesc, Calendar, RefreshCw, AlertCircle, AlertTriangle, Pencil, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const GestionDocumentosPage = () => {
    const { user, profile, getSinglePlant } = useAuth();

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
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverFolder, setDragOverFolder] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    const isAdmin = () => {
        return profile?.rol === 'admin' || profile?.rol === 'empleado';
    };

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

    const handleDragStart = (e, item, type) => {
        if (!isAdmin()) {
            e.preventDefault();
            return;
        }

        setDraggedItem({ ...item, type });
        setIsDragging(true);

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');

        // Crear imagen personalizada para el drag
        const dragImage = createDragImage(item, type);

        // Usar la imagen personalizada
        e.dataTransfer.setDragImage(dragImage, 125, 20);

        // Limpiar el elemento temporal después de un momento
        setTimeout(() => {
            if (dragImage && dragImage.parentNode) {
                document.body.removeChild(dragImage);
            }
        }, 0);

        // Reducir la opacidad del elemento original solo ligeramente
        e.target.style.opacity = '0.7';
    };

    const handleDragEnd = (e) => {
        e.target.style.opacity = '1';
        setDraggedItem(null);
        setDragOverFolder(null);
        setIsDragging(false);
    };

    const createDragImage = (item, type) => {
        // Crear un elemento temporal para la imagen de drag
        const dragElement = document.createElement('div');
        dragElement.style.position = 'absolute';
        dragElement.style.top = '-1000px';
        dragElement.style.left = '-1000px';
        dragElement.style.padding = '8px 12px';
        dragElement.style.backgroundColor = '#3b82f6';
        dragElement.style.color = 'white';
        dragElement.style.borderRadius = '6px';
        dragElement.style.fontSize = '14px';
        dragElement.style.fontWeight = '500';
        dragElement.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        dragElement.style.maxWidth = '250px';
        dragElement.style.whiteSpace = 'nowrap';
        dragElement.style.overflow = 'hidden';
        dragElement.style.textOverflow = 'ellipsis';

        if (type === 'document') {
            dragElement.innerHTML = `${item.original_name || item.name}`;
        } else if (type === 'folder') {
            dragElement.innerHTML = `${item.name}`;
        }

        document.body.appendChild(dragElement);

        return dragElement;
    };

    const handleDragOver = (e, folderId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedItem && isValidDropTarget(draggedItem, folderId)) {
            setDragOverFolder(folderId);
        }
    };

    const handleDragLeave = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverFolder(null);
        }
    };

    const handleDrop = async (e, targetFolderId) => {
        e.preventDefault();
        setDragOverFolder(null);

        if (!draggedItem || !isValidDropTarget(draggedItem, targetFolderId)) {
            return;
        }

        try {
            if (draggedItem.type === 'folder') {
                await moveFolder(draggedItem, targetFolderId);
            } else if (draggedItem.type === 'document') {
                await moveDocument(draggedItem, targetFolderId);
            }

            showNotification('Elemento movido correctamente', 'success');
            await refreshData(true);
        } catch (error) {
            console.error('Error moving item:', error);
            showNotification('Error al mover elemento: ' + error.message, 'error');
        }

        setDraggedItem(null);
        setIsDragging(false);
    };

    const isValidDropTarget = (draggedItem, targetFolderId) => {
        if (!draggedItem) return false;

        // No se puede mover un elemento a sí mismo
        if (draggedItem.type === 'folder' && draggedItem.id === targetFolderId) {
            return false;
        }

        // Para carpetas: verificar que no sea descendiente
        if (draggedItem.type === 'folder') {
            // Si el target es root, siempre es válido (a menos que ya esté en root)
            if (targetFolderId === 'root') {
                return draggedItem.parent_id !== null && draggedItem.parent_id !== 'root';
            }
            return !isDescendantFolder(targetFolderId, draggedItem.id);
        }

        // Para documentos: verificar que no esté ya en esa carpeta
        if (draggedItem.type === 'document') {
            return draggedItem.folder_id !== targetFolderId;
        }

        return true;
    };

    const isDescendantFolder = (folderId, ancestorId) => {
        if (!folderId || folderId === 'root') return false;

        const folder = folders.find(f => f.id === folderId);
        if (!folder) return false;

        if (folder.parent_id === ancestorId) return true;

        return isDescendantFolder(folder.parent_id, ancestorId);
    };

    const moveFolder = async (folder, newParentId) => {
        const oldParentId = folder.parent_id;

        const { error } = await supabase
            .from('folders')
            .update({
                parent_id: newParentId === 'root' ? null : newParentId,
                updated_at: new Date().toISOString()
            })
            .eq('id', folder.id);

        if (error) throw error;

        await moveFolderInStorage(folder, oldParentId, newParentId);
    };

    const moveDocument = async (document, newFolderId) => {
        const oldFolderPath = getFolderStoragePath(document.folder_id);
        const newFolderPath = getFolderStoragePath(newFolderId);

        const fileName = document.file_path.split('/').pop();
        const oldFilePath = document.file_path;
        const newFilePath = newFolderPath ? `${newFolderPath}/${fileName}` : fileName;

        const { error: moveError } = await supabase.storage
            .from('documents')
            .move(oldFilePath, newFilePath);

        if (moveError) throw moveError;

        const { data: { publicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(newFilePath);

        const { error: updateError } = await supabase
            .from('documents')
            .update({
                folder_id: newFolderId,
                file_path: newFilePath,
                file_url: publicUrl,
                updated_at: new Date().toISOString()
            })
            .eq('id', document.id);

        if (updateError) throw updateError;
    };

    const moveFolderInStorage = async (folder, oldParentId, newParentId) => {
        const oldFolderPath = getFolderStoragePath(folder.id);
        const newFolderPath = buildNewFolderPath(folder, newParentId);

        if (oldFolderPath === newFolderPath) return;

        try {
            const { data: files, error: listError } = await supabase.storage
                .from('documents')
                .list(oldFolderPath, { limit: 1000 });

            if (listError && !listError.message.includes('not found')) {
                throw listError;
            }

            const filesToMove = files || [];

            for (const file of filesToMove) {
                if (file.name === '.emptyFolderPlaceholder') continue;

                const oldFilePath = oldFolderPath ? `${oldFolderPath}/${file.name}` : file.name;
                const newFilePath = newFolderPath ? `${newFolderPath}/${file.name}` : file.name;

                const { error: moveError } = await supabase.storage
                    .from('documents')
                    .move(oldFilePath, newFilePath);

                if (moveError) {
                    console.warn(`Error moviendo ${file.name}:`, moveError);
                    continue;
                }

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
                    .eq('file_path', oldFilePath);
            }

            if (newFolderPath) {
                await createFolderInStorage(newFolderPath);
            }

            try {
                if (oldFolderPath) {
                    await supabase.storage
                        .from('documents')
                        .remove([`${oldFolderPath}/.emptyFolderPlaceholder`]);
                }
            } catch (cleanupError) {
                console.warn('Error limpiando carpeta anterior:', cleanupError);
            }

        } catch (error) {
            console.error('Error moving folder in storage:', error);
            throw error;
        }
    };

    const buildNewFolderPath = (folder, newParentId) => {
        if (newParentId === 'root') {
            return sanitizeFolderName(folder.name);
        }

        const parentPath = getFolderStoragePath(newParentId);
        const sanitizedName = sanitizeFolderName(folder.name);
        return parentPath ? `${parentPath}/${sanitizedName}` : sanitizedName;
    };

    const reloadAllData = useCallback(async (silent = false) => {
        if (!silent) {
            setLoading(true);
        }

        try {
            // Cargar datos frescos SIN limpiar estados primero
            const [foldersResult, documentsResult] = await Promise.all([
                loadFoldersFromSupabase(true),
                loadDocumentsFromSupabase(true)
            ]);

            if (!silent) {
                showNotification('Datos actualizados', 'success');
            }
        } catch (error) {
            console.error('Error reloading data:', error);
            if (!silent) {
                showNotification('Error al actualizar datos: ' + error.message, 'error');
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, []);

    const refreshData = reloadAllData;

    const handleBackgroundClick = (e) => {
        if (e.target === e.currentTarget) {
            const singlePlant = getSinglePlant();
            // Si es cliente con una sola planta, no permitir volver a root
            if (!singlePlant) {
                setSelectedFolder('root');
            }
        }
    };

    useEffect(() => {
        const pollInterval = setInterval(async () => {
            try {
                if (!isUploading && !loading && !isDragging) {
                    await reloadAllData(true);
                }
            } catch (error) {
                console.error('Error en polling:', error);
            }
        }, 5000);

        return () => {
            clearInterval(pollInterval);
        };
    }, [isUploading, loading, reloadAllData]);

    const startCreatingFolder = () => {
        const singlePlant = getSinglePlant();

        // Si es cliente con una sola planta, no permitir crear carpetas en la raíz
        if (singlePlant && selectedFolder === 'root') {
            showNotification('No tienes permisos para crear carpetas en el nivel raíz', 'warning');
            return;
        }

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
                        original_name: folder.name,
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

    const loadFoldersFromSupabase = async (skipNotification = true) => {
        try {
            const { data, error } = await supabase
                .from('folders')
                .select('*')
                .order('name');

            if (error) {
                console.error('Error cargando carpetas:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                await createInitialStructure();
                return [];
            }

            setFolders(data);
            return data;
        } catch (error) {
            console.error('Error loading folders:', error);
            await createInitialStructure();
            return [];
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

            // Crear nuevo path sanitizado para storage
            let newStoragePath = '';
            if (folder.parent_id) {
                const parentPath = getFolderStoragePath(folder.parent_id);
                const sanitizedNewName = sanitizeFolderName(newName);
                newStoragePath = parentPath ? `${parentPath}/${sanitizedNewName}` : sanitizedNewName;
            } else {
                newStoragePath = sanitizeFolderName(newName);
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
                    name: newName, // ← Nombre original CON tildes
                    original_name: newName, // ← También actualizar original_name
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

            showNotification('Carpeta eliminada correctamente', 'success');

            await refreshData(true);
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

    const loadDocumentsFromSupabase = async (skipNotification = true) => {
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error cargando documentos:', error);
                throw error;
            }

            setDocuments(data || []);

            return data || [];
        } catch (error) {
            console.error('Error loading documents:', error);
            setDocuments([]);
            return [];
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

    const sanitizeFileName = (fileName) => {
        try {
            // Separar nombre y extensión
            const lastDotIndex = fileName.lastIndexOf('.');
            let name = fileName;
            let extension = '';

            if (lastDotIndex > 0) {
                name = fileName.substring(0, lastDotIndex);
                extension = fileName.substring(lastDotIndex);
            }

            // Sanitización estricta para Supabase Storage
            const sanitizedName = name
                .normalize('NFD') // Descomponer caracteres acentuados
                .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
                .replace(/ñ/g, 'n').replace(/Ñ/g, 'N') // Reemplazar ñ
                .replace(/[^a-zA-Z0-9\-_]/g, '_') // Solo letras, números, guiones y guiones bajos
                .replace(/_{2,}/g, '_') // Reemplazar múltiples guiones bajos por uno solo
                .replace(/^_+|_+$/g, '') // Eliminar guiones bajos al inicio y final
                .trim();

            // Asegurar que el nombre no esté vacío
            const finalName = sanitizedName || 'archivo';
            const result = finalName + extension;

            return result;
        } catch (error) {
            console.error('Error en sanitizeFileName:', error);
            // Fallback super seguro
            const timestamp = Date.now();
            const ext = fileName.split('.').pop() || 'txt';
            return `archivo_${timestamp}.${ext}`;
        }
    };

    const uploadFileToSupabase = async (file, folderId = 'root') => {
        try {
            // Verificar que el archivo sea válido
            if (!file || !file.name) {
                throw new Error('Archivo inválido');
            }

            // USAR SANITIZACIÓN ESTRICTA para Supabase Storage
            let fileName = sanitizeFileName(file.name);

            if (!fileName || fileName === '.') {
                throw new Error('Nombre de archivo inválido después de sanitización');
            }

            let filePath;

            if (folderId === 'root') {
                filePath = fileName;
            } else {
                const folderPath = getFolderStoragePath(folderId);
                filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
            }

            const pathParts = filePath.split('/');
            const folderToCheck = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';

            // Verificar si ya existe un archivo con el mismo nombre
            const { data: existingFile, error: listError } = await supabase.storage
                .from('documents')
                .list(folderToCheck, {
                    search: fileName
                });

            if (listError) {
                console.warn('Error al verificar archivos existentes:', listError);
                // Continuar sin verificar duplicados
            }

            if (existingFile && existingFile.length > 0) {
                // Crear nombre único si ya existe
                const fileExt = fileName.substring(fileName.lastIndexOf('.')) || '';
                const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
                fileName = `${nameWithoutExt}_${Date.now()}${fileExt}`;

                if (folderId === 'root') {
                    filePath = fileName;
                } else {
                    const folderPath = getFolderStoragePath(folderId);
                    filePath = folderPath ? `${folderPath}/${fileName}` : fileName;
                }
            }

            // Subir archivo
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (uploadError) {
                console.error('Error en upload de Supabase:', uploadError);
                throw new Error(`Error al subir archivo: ${uploadError.message}`);
            }

            // Obtener URL pública
            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(filePath);

            // Preparar datos para la base de datos
            const documentData = {
                name: file.name,
                original_name: file.name,
                file_path: filePath,
                file_url: publicUrl,
                size: file.size,
                mime_type: file.type || 'application/octet-stream',
                folder_id: folderId,
                uploaded_by: user?.username || 'Anónimo',
                description: '',
                tags: [],
                category: '',
                plant: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Guardar en la base de datos
            const { data: documentRecord, error: dbError } = await supabase
                .from('documents')
                .insert([documentData])
                .select()
                .single();

            if (dbError) {
                console.error('Error en base de datos:', dbError);
                // Intentar limpiar el archivo subido si falla la DB
                try {
                    await supabase.storage
                        .from('documents')
                        .remove([filePath]);
                } catch (cleanupError) {
                    console.warn('No se pudo limpiar archivo tras error de DB:', cleanupError);
                }
                throw new Error(`Error al guardar en base de datos: ${dbError.message}`);
            }

            return documentRecord;
        } catch (error) {
            const errorMessage = error?.message || 'Error desconocido en upload';
            throw new Error(errorMessage);
        }
    };

    const createFolderInSupabase = async (folderName, parentId = 'root') => {
        try {
            const folderId = crypto.randomUUID();

            const folderData = {
                id: folderId,
                name: folderName,
                original_name: folderName,
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

            // Para el storage, usar nombre sanitizado
            let folderStoragePath = '';
            if (parentId !== 'root') {
                const parentPath = getFolderStoragePath(parentId);
                const sanitizedName = sanitizeFolderName(folderName);
                folderStoragePath = parentPath ? `${parentPath}/${sanitizedName}` : sanitizedName;
            } else {
                folderStoragePath = sanitizeFolderName(folderName);
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

            showNotification('Documento eliminado correctamente', 'success');

            await refreshData(true);
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

            await refreshData(true);

            showNotification('Archivos subidos correctamente', 'success');
        } catch (error) {
            console.error('Error uploading files:', error);
            showNotification('Error al subir archivos: ' + error.message, 'error');
        } finally {
            setIsUploading(false);
        }
    };

    useEffect(() => {
        const singlePlant = getSinglePlant();

        // Solo ejecutar si ya tenemos carpetas cargadas y no estamos cargando
        if (!loading && folders.length > 0 && singlePlant) {
            const plantFolder = folders.find(folder =>
                folder.name.toLowerCase().includes(singlePlant.toLowerCase()) ||
                (folder.name.toLowerCase() === 'lamaja' && singlePlant === 'LAMAJA') ||
                (folder.name.toLowerCase() === 'retamar' && singlePlant === 'RETAMAR')
            );

            if (plantFolder && selectedFolder === 'root') {
                setSelectedFolder(plantFolder.id);
                setExpandedFolders(prev => new Set([...prev, plantFolder.id]));
            }
        }
    }, [folders, loading, selectedFolder]);

    useEffect(() => {
        const initializeData = async () => {
            setLoading(true);
            try {
                const [foldersResult, documentsResult] = await Promise.all([
                    loadFoldersFromSupabase(true),
                    loadDocumentsFromSupabase(true)
                ]);

                // Si es cliente con una sola planta, seleccionar automáticamente su carpeta
                const singlePlant = getSinglePlant();
                if (singlePlant && foldersResult && foldersResult.length > 0) {
                    // Buscar la carpeta que corresponde a la planta del usuario
                    const plantFolder = foldersResult.find(folder =>
                        folder.name.toLowerCase().includes(singlePlant.toLowerCase()) ||
                        (folder.name.toLowerCase() === 'lamaja' && singlePlant === 'LAMAJA') ||
                        (folder.name.toLowerCase() === 'retamar' && singlePlant === 'RETAMAR')
                    );

                    if (plantFolder) {
                        setSelectedFolder(plantFolder.id);
                        setExpandedFolders(new Set([plantFolder.id]));
                    }
                }
            } catch (error) {
                console.error('Error initializing data:', error);
                showNotification('Error al cargar datos: ' + error.message, 'error');
            } finally {
                setLoading(false);
            }
        };

        // Solo ejecutar una vez al montar el componente
        initializeData();
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
    }, [refreshData]);

    const handleManualRefresh = async () => {
        await reloadAllData(false);
    };

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
        const singlePlant = getSinglePlant();

        // Si es cliente con una sola planta, no permitir seleccionar root
        if (singlePlant && folderId === 'root') {
            return;
        }

        setSelectedFolder(folderId);
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            newSet.add(folderId);
            return newSet;
        });
    };

    // Función helper para verificar si una carpeta es hija de la carpeta de la planta
    const isChildOfPlantFolder = (folder, singlePlant, allFolders) => {
        if (!folder.parent_id || folder.parent_id === 'root') {
            return false;
        }

        // Buscar la carpeta padre
        const parentFolder = allFolders.find(f => f.id === folder.parent_id);
        if (!parentFolder) {
            return false;
        }

        // Verificar si el padre es la carpeta de la planta
        const isParentPlantFolder = (
            parentFolder.name.toLowerCase() === singlePlant.toLowerCase() ||
            (parentFolder.name.toLowerCase() === 'lamaja' && singlePlant === 'LAMAJA') ||
            (parentFolder.name.toLowerCase() === 'retamar' && singlePlant === 'RETAMAR')
        );

        if (isParentPlantFolder) {
            return true;
        }

        // Verificar recursivamente si algún ancestro es la carpeta de la planta
        return isChildOfPlantFolder(parentFolder, singlePlant, allFolders);
    };

    const getFolderHierarchy = () => {
        const folderMap = new Map();
        const rootFolders = [];

        // Filtrar carpetas que NO sean root
        const regularFolders = folders.filter(folder => folder.id !== 'root');

        // NUEVO: Filtrar carpetas por planta si el usuario es cliente con una sola planta
        const singlePlant = getSinglePlant();

        if (singlePlant) {
            // Primero, encontrar la carpeta principal de la planta
            const plantMainFolder = regularFolders.find(folder => {
                const isPlantMainFolder = (
                    folder.name.toLowerCase() === singlePlant.toLowerCase() ||
                    (folder.name.toLowerCase() === 'lamaja' && singlePlant === 'LAMAJA') ||
                    (folder.name.toLowerCase() === 'retamar' && singlePlant === 'RETAMAR')
                );
                return isPlantMainFolder && (folder.parent_id === null || folder.parent_id === 'root');
            });

            if (plantMainFolder) {
                // Función recursiva para obtener todos los descendientes de la carpeta de la planta
                const getAllDescendants = (parentId, allFolders) => {
                    const descendants = [];
                    const directChildren = allFolders.filter(f => f.parent_id === parentId);

                    for (const child of directChildren) {
                        descendants.push(child);
                        // Recursivamente agregar todos los descendientes de este hijo
                        descendants.push(...getAllDescendants(child.id, allFolders));
                    }

                    return descendants;
                };

                // Obtener todas las subcarpetas (descendientes) de la carpeta principal de la planta
                const filteredFolders = getAllDescendants(plantMainFolder.id, regularFolders);

                filteredFolders.forEach(folder => {
                    folderMap.set(folder.id, { ...folder, children: [] });
                });

                filteredFolders.forEach(folder => {
                    // Si el padre es la carpeta principal de la planta, este será un folder raíz en nuestro árbol
                    if (folder.parent_id === plantMainFolder.id) {
                        rootFolders.push(folderMap.get(folder.id));
                    } else {
                        // De lo contrario, agregarlo como hijo de su padre
                        const parent = folderMap.get(folder.parent_id);
                        if (parent) {
                            parent.children.push(folderMap.get(folder.id));
                        }
                    }
                });
            }
        } else {
            // Para admin o usuarios con múltiples plantas, mostrar todo
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
        }

        return rootFolders;
    };

    const getCurrentFolderDocuments = () => {
        const singlePlant = getSinglePlant();

        return documents.filter(doc => {
            let matchesFolder = false;

            // Si es cliente con una sola planta y selectedFolder es 'root', 
            // buscar documentos en la carpeta de la planta
            if (singlePlant && selectedFolder === 'root') {
                const plantFolder = folders.find(folder =>
                    folder.name.toLowerCase().includes(singlePlant.toLowerCase()) ||
                    (folder.name.toLowerCase() === 'lamaja' && singlePlant === 'LAMAJA') ||
                    (folder.name.toLowerCase() === 'retamar' && singlePlant === 'RETAMAR')
                );
                matchesFolder = plantFolder ? doc.folder_id === plantFolder.id : false;
            } else if (selectedFolder === 'root') {
                matchesFolder = doc.folder_id === 'root' || doc.folder_id === null;
            } else {
                matchesFolder = doc.folder_id === selectedFolder;
            }

            const matchesSearch = searchTerm === '' ||
                doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                doc.description.toLowerCase().includes(searchTerm.toLowerCase());

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
                    className={`folder-item group flex items-center gap-2 py-2 px-2 rounded cursor-pointer hover:bg-gray-100 transition-colors relative ${isSelected ? 'bg-blue-100 border-l-4 border-blue-500' : ''
                        } ${dragOverFolder === folder.id ? 'bg-green-100 border-2 border-green-400' : ''}`}
                    style={{ paddingLeft: `${level * 16 + 8}px` }}
                    onClick={!isEditing ? () => selectFolder(folder.id) : undefined}
                    draggable={isAdmin() && !isEditing}
                    onDragStart={(e) => handleDragStart(e, folder, 'folder')}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, folder.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, folder.id)}
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
                        <div className="flex items-center gap-2 flex-1 min-w-0">
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
                                className="flex-1 min-w-0 text-sm px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveRename(folder);
                                    }}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors cursor-pointer flex-shrink-0"
                                    title="Guardar"
                                >
                                    <Check size={14} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelEdit();
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors cursor-pointer flex-shrink-0"
                                    title="Cancelar"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <span className={`text-sm truncate flex-1 ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>
                                {folder.name}
                            </span>

                            {/* Menú de tres puntos que aparece en hover - Solo para admin */}
                            {isAdmin() && (
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
                            )}
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
        const singlePlant = getSinglePlant();

        // Si es cliente con una sola planta, mostrar solo el nombre de la planta
        if (singlePlant) {
            if (folderId === 'root') {
                return singlePlant === 'LAMAJA' ? 'LA MAJA' : 'RETAMAR';
            }

            const folder = folders.find(f => f.id === folderId);
            if (!folder) return singlePlant === 'LAMAJA' ? 'LA MAJA' : 'RETAMAR';

            const buildPath = (currentFolder) => {
                if (!currentFolder || currentFolder.parent_id === null || currentFolder.parent_id === 'root') {
                    return currentFolder ? [currentFolder.name] : [];
                }

                const parent = folders.find(f => f.id === currentFolder.parent_id);
                return [...buildPath(parent), currentFolder.name];
            };

            const path = buildPath(folder);
            const plantName = singlePlant === 'LAMAJA' ? 'LA MAJA' : 'RETAMAR';

            return path.length > 1 ? `${plantName} > ${path.slice(1).join(' > ')}` : plantName;
        }

        // Para admin o usuarios con múltiples plantas
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
                    className={`w-80 border-r border-gray-200 bg-white overflow-y-auto ${dragOverFolder === 'root' ? 'bg-green-50' : ''
                        }`}
                    onClick={handleBackgroundClick}
                    onDragOver={(e) => {
                        // Solo permitir drop en el fondo si no estamos sobre una carpeta específica
                        if (e.target === e.currentTarget || e.target.closest('.folder-item') === null) {
                            handleDragOver(e, 'root');
                        }
                    }}
                    onDragLeave={(e) => {
                        // Solo limpiar si realmente salimos del panel completo
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                            setDragOverFolder(null);
                        }
                    }}
                    onDrop={(e) => {
                        // Solo permitir drop en el fondo si no estamos sobre una carpeta específica
                        if (e.target === e.currentTarget || e.target.closest('.folder-item') === null) {
                            handleDrop(e, 'root');
                        }
                    }}
                >
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div
                                className={`text-sm font-semibold text-gray-700 flex items-center gap-2 p-2 rounded transition-colors ${dragOverFolder === 'root' ? 'bg-green-100 border-2 border-green-400' : ''
                                    }`}
                                onDragOver={(e) => handleDragOver(e, 'root')}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, 'root')}
                            >
                                <Folder size={16} className="text-yellow-600" />
                                {(() => {
                                    const singlePlant = getSinglePlant();
                                    if (singlePlant) {
                                        return singlePlant === 'LAMAJA' ? 'LA MAJA' : 'RETAMAR';
                                    }
                                    return folders.find(f => f.id === 'root')?.name || 'PLANTAS';
                                })()}
                            </div>
                            {isAdmin() && (
                                <button
                                    onClick={startCreatingFolder}
                                    disabled={creatingNewFolder}
                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover-bg-blue rounded-md transition-colors cursor-pointer disabled:opacity-50"
                                    title="Crear nueva carpeta"
                                >
                                    <Plus size={16} />
                                </button>
                            )}
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
                                    {/* Solo mostrar checkbox si es admin */}
                                    {isAdmin() && (
                                        <th className="text-left p-3 font-medium text-gray-700 text-sm w-12">
                                            <input
                                                type="checkbox"
                                                checked={sortedDocuments.length > 0 && selectedDocuments.size === sortedDocuments.length}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </th>
                                    )}
                                    <th className="text-left p-3 font-medium text-gray-700 text-sm">Nombre</th>
                                    <th className="text-left p-3 font-medium text-gray-700 text-sm">Tamaño</th>
                                    <th className="text-center p-3 font-medium text-gray-700 text-sm">Fecha de modificación</th>
                                    <th className="text-center p-3 font-medium text-gray-700 text-sm">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedDocuments.map(document => (
                                    <tr
                                        key={document.id}
                                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                        draggable={isAdmin()}
                                        onDragStart={(e) => handleDragStart(e, document, 'document')}
                                        onDragEnd={handleDragEnd}
                                    >
                                        {/* Solo mostrar checkbox si es admin */}
                                        {isAdmin() && (
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDocuments.has(document.id)}
                                                    onChange={(e) => handleDocumentSelection(document.id, e.target.checked)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                            </td>
                                        )}
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                <FileText className="text-blue-500 flex-shrink-0" size={20} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium text-gray-900 truncate">
                                                            {document.original_name || document.name}
                                                        </span>
                                                    </div>
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
                                                {/* Botón descargar - SIEMPRE visible */}
                                                <button
                                                    onClick={() => handleDownload(document)}
                                                    className="p-2 text-blue-600 hover-bg-blue rounded-md transition-colors cursor-pointer"
                                                    title="Descargar"
                                                >
                                                    <Download size={14} />
                                                </button>
                                                {/* Botón eliminar - SOLO para admin */}
                                                {isAdmin() && (
                                                    <button
                                                        onClick={() => confirmDeleteDocument(document)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
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
                {/* Botón de descargar - Solo si es admin Y hay archivos seleccionados */}
                {isAdmin() && selectedDocuments.size > 0 && (
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

                {/* Botón de subir - Solo si es admin */}
                {isAdmin() && (
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
                )}
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