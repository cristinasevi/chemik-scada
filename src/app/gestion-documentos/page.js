'use client';

import { useState, useEffect } from 'react';
import {
    ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Upload, Download, Trash2, Eye, Search,
    Plus, X, MoreVertical, Grid, List, SortAsc, SortDesc, Filter, Calendar, User, Tag, Cloud, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const GestionDocumentosPage = () => {
    const { user, isAdmin } = useAuth();

    // Estados principales
    const [documents, setDocuments] = useState([]);
    const [folders, setFolders] = useState([]);
    const [expandedFolders, setExpandedFolders] = useState(new Set(['root']));
    const [selectedFolder, setSelectedFolder] = useState('root');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('list');
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);

    // Estados para Google Drive
    const [isGoogleAuth, setIsGoogleAuth] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [googleAuthInstance, setGoogleAuthInstance] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Configuración de Google Drive API - ACTUALIZADO CON PERMISOS DE ESCRITURA
    const GOOGLE_CLIENT_ID = '890321344192-5k0qkn1ds7sfo4r8s08v898gl5lvesu1.apps.googleusercontent.com';
    const GOOGLE_API_KEY = 'AIzaSyAXtodMMbdTCs3gj7FOiA1XzVZ6NIDtI2k';
    const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
    const SCOPES = 'https://www.googleapis.com/auth/drive'; // Cambiado para incluir escritura

    // Estados para formularios
    const [uploadForm, setUploadForm] = useState({
        files: [],
        category: '',
        plant: '',
        tags: [],
        description: ''
    });

    const [folderForm, setFolderForm] = useState({
        name: '',
        description: '',
        parent: 'root',
        plant: '',
        category: ''
    });

    // ===== FUNCIONES PRINCIPALES =====

    // Función para cargar estructura por defecto
    const loadDefaultStructure = () => {
        setFolders([{
            id: 'root',
            name: 'PLANTAS',
            parent: null,
            children: [],
            type: 'root'
        }]);
        setDocuments([]);
        setExpandedFolders(new Set(['root']));
        setSelectedFolder('root');
        setLoading(false);
    };

    // Función para configurar Google Identity
    const initGoogleIdentity = () => {
        try {
            console.log('=== CONFIGURANDO GOOGLE IDENTITY ===');

            if (!window.google?.accounts?.oauth2) {
                console.error('Google Identity Services no disponible');
                loadDefaultStructure();
                return;
            }

            // Configurar el cliente OAuth2
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: SCOPES,
                callback: (response) => {
                    console.log('Token recibido:', !!response.access_token);
                    if (response.access_token) {
                        setIsGoogleAuth(true);
                        setIsGoogleLoading(false);
                        loadGoogleDriveFiles();
                    }
                },
                error_callback: (error) => {
                    console.error('Error en callback:', error);
                    setIsGoogleAuth(false);
                    setIsGoogleLoading(false);
                }
            });

            setGoogleAuthInstance(client);
            console.log('✅ Google Identity configurado correctamente');
            loadDefaultStructure();

        } catch (error) {
            console.error('Error configurando Google Identity:', error);
            loadDefaultStructure();
        }
    };

    // Función para hacer login en Google
    const signInToGoogle = async () => {
        if (!googleAuthInstance) {
            console.error('Cliente OAuth no inicializado');
            return;
        }

        setIsGoogleLoading(true);
        try {
            console.log('Solicitando token de acceso...');

            // Solicitar token de acceso
            googleAuthInstance.requestAccessToken({
                prompt: 'consent'
            });

        } catch (error) {
            console.error('Error en sign in:', error);
            setIsGoogleLoading(false);
        }
    };

    // Función para hacer logout de Google
    const signOutFromGoogle = () => {
        // Revocar token
        if (window.google?.accounts?.oauth2) {
            window.google.accounts.oauth2.revoke('', () => {
                console.log('Token revocado');
            });
        }

        setIsGoogleAuth(false);
        setGoogleAuthInstance(null);
        setIsGoogleLoading(false);
        loadDefaultStructure();
    };

    // ===== NUEVAS FUNCIONES DE SUBIDA =====

    // Función para subir archivo a Google Drive
    const uploadFileToGoogleDrive = async (file, parentFolderId = null) => {
        try {
            console.log('Subiendo archivo:', file.name);

            // Obtener el ID de la carpeta padre
            const targetFolderId = parentFolderId || getCurrentFolderGoogleId();

            // Crear metadata del archivo
            const metadata = {
                name: file.name,
                parents: targetFolderId ? [targetFolderId] : undefined
            };

            // Crear FormData para el archivo
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            // Subir archivo
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({
                    'Authorization': `Bearer ${window.gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token}`
                }),
                body: form
            });

            if (!response.ok) {
                throw new Error(`Error al subir archivo: ${response.status}`);
            }

            const result = await response.json();
            console.log('Archivo subido exitosamente:', result);

            return result;

        } catch (error) {
            console.error('Error subiendo archivo:', error);
            throw error;
        }
    };

    // Función para crear carpeta en Google Drive
    const createFolderInGoogleDrive = async (folderName, parentFolderId = null) => {
        try {
            console.log('Creando carpeta:', folderName);

            // Obtener el ID de la carpeta padre
            const targetFolderId = parentFolderId || getCurrentFolderGoogleId();

            const metadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: targetFolderId ? [targetFolderId] : undefined
            };

            const response = await window.gapi.client.drive.files.create({
                resource: metadata
            });

            console.log('Carpeta creada exitosamente:', response.result);
            return response.result;

        } catch (error) {
            console.error('Error creando carpeta:', error);
            throw error;
        }
    };

    // Función para obtener el Google ID de la carpeta actual
    const getCurrentFolderGoogleId = () => {
        if (selectedFolder === 'root') {
            // Buscar el Google ID de la carpeta PLANTAS
            const plantasFolder = folders.find(f => f.id === 'root');
            return plantasFolder?.googleId || null;
        } else {
            const folder = folders.find(f => f.id === selectedFolder);
            return folder?.googleId || null;
        }
    };

    // Handler para subir archivos
    const handleFileUpload = async (files) => {
        if (!isGoogleAuth) {
            alert('Conecta tu cuenta de Google Drive primero');
            return;
        }

        setIsUploading(true);
        try {
            const uploadPromises = Array.from(files).map(file => uploadFileToGoogleDrive(file));
            await Promise.all(uploadPromises);

            // Recargar la estructura después de subir
            await loadGoogleDriveFiles();
            setShowUploadModal(false);
            setUploadForm({ files: [], category: '', plant: '', tags: [], description: '' });

            alert('Archivos subidos exitosamente');

        } catch (error) {
            console.error('Error subiendo archivos:', error);
            alert('Error al subir archivos: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    // Handler para crear carpeta
    const handleCreateFolder = async () => {
        if (!isGoogleAuth) {
            alert('Conecta tu cuenta de Google Drive primero');
            return;
        }

        if (!folderForm.name.trim()) {
            alert('Ingresa un nombre para la carpeta');
            return;
        }

        setIsUploading(true);
        try {
            await createFolderInGoogleDrive(folderForm.name.trim());

            // Recargar la estructura después de crear la carpeta
            await loadGoogleDriveFiles();
            setShowCreateFolderModal(false);
            setFolderForm({ name: '', description: '', parent: 'root', plant: '', category: '' });

            alert('Carpeta creada exitosamente');

        } catch (error) {
            console.error('Error creando carpeta:', error);
            alert('Error al crear carpeta: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    // Función para cargar archivos de Google Drive
    const loadGoogleDriveFiles = async () => {
        setLoading(true);
        try {
            console.log('Cargando archivos de Google Drive...');

            // Buscar carpeta PLANTAS en Google Drive
            const plantasResponse = await window.gapi.client.drive.files.list({
                q: "name='PLANTAS' and mimeType='application/vnd.google-apps.folder'",
                fields: 'files(id, name, parents)'
            });

            let plantasFolderId = null;
            if (plantasResponse.result.files.length > 0) {
                plantasFolderId = plantasResponse.result.files[0].id;
                console.log('Carpeta PLANTAS encontrada:', plantasFolderId);
            } else {
                console.log('Carpeta PLANTAS no encontrada, usando raíz');
            }

            // Si no existe PLANTAS, usar la raíz
            const rootFolderId = plantasFolderId || 'root';

            // Cargar estructura de carpetas y archivos
            await loadFolderStructure(rootFolderId, 'root', 'PLANTAS');

        } catch (error) {
            console.error('Error loading Google Drive files:', error);
            loadDefaultStructure();
        }
        setLoading(false);
    };

    // Función para cargar estructura de carpetas
    const loadFolderStructure = async (folderId, parentId, folderName) => {
        try {
            // Cargar toda la estructura recursivamente
            const allFolders = [];
            const allDocuments = [];

            const loadFolderRecursive = async (currentFolderId, currentParentId, currentName, level = 0) => {
                const response = await window.gapi.client.drive.files.list({
                    q: `'${currentFolderId}' in parents and trashed=false`,
                    fields: 'files(id, name, mimeType, parents, createdTime, size)',
                    orderBy: 'name'
                });

                const files = response.result.files;
                const currentFolder = {
                    id: currentParentId,
                    name: currentName,
                    parent: currentParentId === 'root' ? null : (level === 1 ? 'root' :
                        allFolders.find(f => f.googleId === currentParentId)?.parent || 'root'),
                    children: [],
                    type: currentParentId === 'root' ? 'root' : 'folder',
                    googleId: currentFolderId
                };

                // Solo agregar la carpeta raíz una vez
                if (currentParentId === 'root') {
                    allFolders.push(currentFolder);
                }

                // Procesar archivos y carpetas
                for (const file of files) {
                    if (file.mimeType === 'application/vnd.google-apps.folder') {
                        // Es una carpeta
                        const subfolder = {
                            id: file.id,
                            name: file.name,
                            parent: currentParentId,
                            children: [],
                            type: 'folder',
                            googleId: file.id
                        };
                        allFolders.push(subfolder);

                        // Encontrar la carpeta padre y agregar este hijo
                        let parentFolder = allFolders.find(f => f.id === currentParentId);
                        if (!parentFolder && currentParentId !== 'root') {
                            // Si no encuentra la carpeta padre, buscar por googleId
                            parentFolder = allFolders.find(f => f.googleId === currentParentId);
                        }
                        if (parentFolder) {
                            parentFolder.children.push(file.id);
                        }

                        // Cargar contenido de la subcarpeta recursivamente
                        await loadFolderRecursive(file.id, file.id, file.name, level + 1);
                    } else {
                        // Es un archivo
                        const document = {
                            id: file.id,
                            name: file.name,
                            size: parseInt(file.size) || 0,
                            type: file.mimeType,
                            folder: currentParentId === 'root' ? 'root' : file.parents[0],
                            uploadedBy: 'Google Drive',
                            uploadedAt: file.createdTime,
                            tags: [],
                            description: ``,
                            googleId: file.id,
                            isGoogleDrive: true
                        };
                        allDocuments.push(document);
                    }
                }
            };

            // Comenzar la carga recursiva
            await loadFolderRecursive(folderId, parentId, folderName);

            // Actualizar estado con toda la estructura
            setFolders(allFolders);
            setDocuments(allDocuments);
            setExpandedFolders(new Set(['root']));

            console.log(`Cargadas ${allFolders.length} carpetas y ${allDocuments.length} archivos`);

        } catch (error) {
            console.error('Error loading folder structure:', error);
        }
    };

    // Función para descargar archivo de Google Drive
    const downloadGoogleDriveFile = async (document) => {
        try {
            // Crear enlace directo de descarga
            const downloadUrl = `https://drive.google.com/uc?export=download&id=${document.googleId}`;
            window.open(downloadUrl, '_blank');
        } catch (error) {
            console.error('Error downloading file:', error);
            // Fallback: abrir en nueva pestaña
            window.open(`https://drive.google.com/file/d/${document.googleId}/view`, '_blank');
        }
    };

    // ===== INICIALIZACIÓN =====

    // Inicializar Google API
    useEffect(() => {
        const loadGoogleAPI = () => {
            // Cargar Google Identity Services y GAPI
            const gisScript = document.createElement('script');
            gisScript.src = 'https://accounts.google.com/gsi/client';
            gisScript.async = true;

            const gapiScript = document.createElement('script');
            gapiScript.src = 'https://apis.google.com/js/api.js';
            gapiScript.async = true;

            let scriptsLoaded = 0;
            const checkAllLoaded = () => {
                scriptsLoaded++;
                if (scriptsLoaded === 2) {
                    console.log('✅ Todos los scripts de Google cargados');
                    initializeGoogleServices();
                }
            };

            gisScript.onload = checkAllLoaded;
            gapiScript.onload = checkAllLoaded;

            gisScript.onerror = gapiScript.onerror = () => {
                console.error('❌ Error cargando scripts de Google');
                loadDefaultStructure();
            };

            document.head.appendChild(gisScript);
            document.head.appendChild(gapiScript);
        };

        const initializeGoogleServices = async () => {
            try {
                console.log('🔄 Inicializando servicios Google...');

                // Inicializar GAPI client
                await new Promise((resolve, reject) => {
                    window.gapi.load('client:auth2', {
                        callback: resolve,
                        onerror: reject
                    });
                });

                await window.gapi.client.init({
                    apiKey: GOOGLE_API_KEY,
                    discoveryDocs: [DISCOVERY_DOC]
                });

                console.log('✅ Google Client inicializado');

                // Configurar Google Identity Services
                if (window.google?.accounts) {
                    initGoogleIdentity();
                } else {
                    console.error('❌ Google Identity Services no disponible');
                    loadDefaultStructure();
                }

            } catch (error) {
                console.error('❌ Error inicializando Google Services:', error);
                loadDefaultStructure();
            }
        };

        // Solo cargar si estamos en el navegador
        if (typeof window !== 'undefined') {
            if (window.gapi && window.google?.accounts) {
                console.log('✅ APIs de Google ya disponibles');
                initializeGoogleServices();
            } else {
                loadGoogleAPI();
            }
        }
    }, []);

    // ===== FUNCIONES DE UTILIDAD =====

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
    };

    // Obtener documentos de la carpeta seleccionada
    const getCurrentFolderDocuments = () => {
        return documents.filter(doc => {
            // Si estamos en root, mostrar archivos de root
            if (selectedFolder === 'root') {
                return doc.folder === 'root';
            }

            // Para otras carpetas, buscar por el ID de Google Drive
            const selectedFolderData = folders.find(f => f.id === selectedFolder);
            const matchesFolder = doc.folder === selectedFolder ||
                (selectedFolderData && doc.folder === selectedFolderData.googleId);

            const matchesSearch = searchTerm === '' ||
                doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                doc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

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
                aValue = new Date(a.uploadedAt);
                bValue = new Date(b.uploadedAt);
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

    // Renderizar árbol de carpetas
    const renderFolderTree = (folderId, level = 0) => {
        const folder = folders.find(f => f.id === folderId);
        if (!folder) return null;

        const isExpanded = expandedFolders.has(folderId);
        const isSelected = selectedFolder === folderId;
        const hasChildren = folder.children && folder.children.length > 0;

        return (
            <div key={folderId}>
                <div
                    className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover-bg ${isSelected ? 'item_selected' : ''}`}
                    style={{ paddingLeft: `${level * 16 + 8}px` }}
                    onClick={() => selectFolder(folderId)}
                >
                    {hasChildren && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleFolder(folderId);
                            }}
                            className="p-1 hover-badge-gray rounded"
                        >
                            {isExpanded ?
                                <ChevronDown size={14} className="text-secondary" /> :
                                <ChevronRight size={14} className="text-secondary" />
                            }
                        </button>
                    )}

                    {!hasChildren && <div className="w-6" />}

                    {isExpanded && hasChildren ?
                        <FolderOpen size={16} className="text-yellow-600" /> :
                        <Folder size={16} className="text-yellow-600" />
                    }

                    <span className={`text-sm truncate ${isSelected ? 'text-selected font-medium' : 'text-primary'}`}>
                        {folder.name}
                    </span>
                </div>

                {isExpanded && hasChildren && (
                    <div>
                        {folder.children.map(childId => renderFolderTree(childId, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    // ===== HANDLERS =====

    const handleDownload = (document) => {
        if (document.isGoogleDrive) {
            downloadGoogleDriveFile(document);
        } else if (document.file) {
            // Archivo local
            const url = URL.createObjectURL(document.file);
            const a = document.createElement('a');
            a.href = url;
            a.download = document.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const handleDelete = (documentId) => {
        if (window.confirm('¿Eliminar este documento?')) {
            setDocuments(prev => prev.filter(doc => doc.id !== documentId));
        }
    };

    // ===== RENDER =====

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-secondary text-sm">
                        {isGoogleLoading ? 'Conectando con Google Drive...' : 'Cargando documentos...'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-background">
            {/* Toolbar superior */}
            <div className="flex items-center justify-between p-4 border-b border-custom bg-panel">
                <div className="flex items-center gap-4">
                    {/* Búsqueda */}
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-2.5 text-secondary" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 w-64 border border-custom rounded-lg bg-panel text-primary text-sm"
                        />
                    </div>

                    {/* Controles de vista */}
                    <div className="flex items-center border border-custom rounded-lg">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-secondary hover-bg'} cursor-pointer rounded-lg`}
                            title="Vista lista"
                        >
                            <List size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-secondary hover-bg'} cursor-pointer rounded-lg`}
                            title="Vista cuadrícula"
                        >
                            <Grid size={16} />
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Estado de Google Drive */}
                    <div className="flex items-center gap-2">
                        {isGoogleAuth ? (
                            <>
                                <button
                                    onClick={loadGoogleDriveFiles}
                                    className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 cursor-pointer"
                                    title="Sincronizar"
                                >
                                    <RefreshCw size={14} />
                                </button>
                                <button
                                    onClick={signOutFromGoogle}
                                    className="px-3 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
                                >
                                    Desconectar
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={signInToGoogle}
                                disabled={isGoogleLoading}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer disabled:opacity-50"
                            >
                                {isGoogleLoading ? 'Conectando...' : 'Conectar Google Drive'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Contenido principal */}
            <div className="flex flex-1 overflow-hidden">
                {/* Panel izquierdo - Árbol de carpetas */}
                <div className="w-80 border-r border-custom bg-panel overflow-y-auto">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-sm font-medium text-secondary">Carpetas</div>
                            <div className="flex items-center gap-2">
                                {isGoogleAuth && (
                                    <button
                                        onClick={() => setShowCreateFolderModal(true)}
                                        disabled={isUploading}
                                        className="p-1 text-blue-500 hover:bg-blue-100 rounded cursor-pointer disabled:opacity-50"
                                        title="Crear carpeta"
                                    >
                                        <Plus size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {renderFolderTree('root')}
                    </div>
                </div>

                {/* Panel derecho - Lista de archivos */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Breadcrumb */}
                    <div className="p-4 border-b border-custom bg-header-table">
                        <div className="text-sm text-secondary">
                            {(() => {
                                const getBreadcrumb = (folderId) => {
                                    const folder = folders.find(f => f.id === folderId);
                                    if (!folder) return 'PLANTAS';

                                    if (folder.parent && folder.parent !== 'root') {
                                        return getBreadcrumb(folder.parent) + ' > ' + folder.name;
                                    }

                                    return folder.name;
                                };

                                return getBreadcrumb(selectedFolder);
                            })()}
                        </div>
                    </div>

                    {/* Lista de archivos */}
                    <div className="flex-1 overflow-y-auto">
                        {viewMode === 'list' ? (
                            <table className="w-full">
                                <thead className="bg-header-table border-b border-custom sticky top-0">
                                    <tr>
                                        <th className="text-left p-3 font-medium text-primary text-sm">Nombre</th>
                                        <th className="text-left p-3 font-medium text-primary text-sm">Tamaño</th>
                                        <th className="text-left p-3 font-medium text-primary text-sm">Modificado</th>
                                        <th className="text-right p-3 pr-6 font-medium text-primary text-sm">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedDocuments.map(document => (
                                        <tr key={document.id} className="border-b border-custom hover-bg">
                                            <td className="p-3">
                                                <div className="flex items-center gap-3">
                                                    <FileText className="text-blue-500" size={20} />
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-primary">{document.name}</span>
                                                        </div>
                                                        <div className="text-sm text-secondary">{document.description}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 text-secondary text-sm">
                                                {formatFileSize(document.size)}
                                            </td>
                                            <td className="p-3 text-secondary text-sm">
                                                {formatDate(document.uploadedAt)}
                                            </td>
                                            <td className="p-3 pr-6">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedDocument(document);
                                                            setShowDocumentModal(true);
                                                        }}
                                                        className="p-2 text-blue-500 hover-badge-blue rounded cursor-pointer"
                                                        title="Ver detalles"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(document)}
                                                        className="p-2 text-blue-500 hover-badge-blue rounded cursor-pointer"
                                                        title="Descargar"
                                                    >
                                                        <Download size={14} />
                                                    </button>
                                                    {!document.isGoogleDrive && (isAdmin || document.uploadedBy === user?.username) && (
                                                        <button
                                                            onClick={() => handleDelete(document.id)}
                                                            className="p-2 text-red-500 hover-badge-red rounded cursor-pointer"
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
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 p-4">
                                {sortedDocuments.map(document => (
                                    <div key={document.id} className="border border-custom rounded-lg p-3 hover-bg cursor-pointer">
                                        <div className="flex flex-col items-center text-center">
                                            <div className="relative">
                                                <FileText className="text-blue-500 mb-2" size={32} />
                                            </div>
                                            <div className="text-sm font-medium text-primary truncate w-full" title={document.name}>
                                                {document.name}
                                            </div>
                                            <div className="text-xs text-secondary mt-1">
                                                {formatFileSize(document.size)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {sortedDocuments.length === 0 && (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-center">
                                    {isGoogleAuth ? (
                                        <>
                                            <h3 className="text-lg font-medium text-primary mb-2">Carpeta vacía</h3>
                                            <p className="text-secondary">
                                                {searchTerm ? 'No se encontraron documentos que coincidan con la búsqueda' : 'Esta carpeta de Google Drive está vacía'}
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <FileText size={48} className="mx-auto text-secondary mb-4" />
                                            <h3 className="text-lg font-medium text-primary mb-2">Sin documentos</h3>
                                            <p className="text-secondary">
                                                Conecta tu Google Drive para ver tus archivos
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {/* Botón flotante para subir archivos */}
                {isGoogleAuth && (
                    <button
                        onClick={() => setShowUploadModal(true)}
                        disabled={isUploading}
                        className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 cursor-pointer disabled:opacity-50 z-40 transition-all duration-200 hover:scale-105"
                        title="Subir archivos"
                    >
                        <Upload size={20} />
                        <span className="hidden sm:block">Subir</span>
                    </button>
                )}
            </div>

            {/* Modal para subir archivos */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-panel rounded-lg w-full max-w-lg">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-primary">Subir Archivos a Google Drive</h3>
                                <button onClick={() => setShowUploadModal(false)} className="p-2 hover-badge-gray rounded cursor-pointer">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Información de la carpeta de destino */}
                                <div className="p-3 bg-blue-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Folder size={16} className="text-blue-500" />
                                        <span className="text-sm text-blue-800 font-medium">
                                            Destino: {(() => {
                                                const getBreadcrumb = (folderId) => {
                                                    const folder = folders.find(f => f.id === folderId);
                                                    if (!folder) return 'PLANTAS';
                                                    if (folder.parent && folder.parent !== 'root') {
                                                        return getBreadcrumb(folder.parent) + ' > ' + folder.name;
                                                    }
                                                    return folder.name;
                                                };
                                                return getBreadcrumb(selectedFolder);
                                            })()}
                                        </span>
                                    </div>
                                </div>

                                {/* Selector de archivos */}
                                <div>
                                    <label className="block text-sm font-medium text-primary mb-2">
                                        Seleccionar archivos
                                    </label>
                                    <input
                                        type="file"
                                        multiple
                                        onChange={(e) => setUploadForm(prev => ({ ...prev, files: Array.from(e.target.files) }))}
                                        className="w-full p-3 border border-custom rounded-lg bg-panel text-primary"
                                    />
                                    {uploadForm.files.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-sm text-secondary mb-1">
                                                {uploadForm.files.length} archivo(s) seleccionado(s):
                                            </p>
                                            <div className="max-h-32 overflow-y-auto">
                                                {uploadForm.files.map((file, index) => (
                                                    <div key={index} className="text-xs text-primary p-1 bg-header-table rounded mb-1">
                                                        {file.name} ({formatFileSize(file.size)})
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Botones */}
                                <div className="flex justify-end gap-3 pt-4 border-t border-custom">
                                    <button
                                        onClick={() => setShowUploadModal(false)}
                                        className="px-4 py-2 text-secondary hover-bg rounded cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => handleFileUpload(uploadForm.files)}
                                        disabled={uploadForm.files.length === 0 || isUploading}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer disabled:opacity-50"
                                    >
                                        {isUploading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Cargando...
                                            </>
                                        ) : (
                                            <>
                                                Aceptar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para crear carpeta */}
            {showCreateFolderModal && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-panel rounded-lg w-full max-w-md">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-primary">Crear Nueva Carpeta</h3>
                                <button onClick={() => setShowCreateFolderModal(false)} className="p-2 hover-badge-gray rounded cursor-pointer">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Información de la carpeta padre */}
                                <div className="p-3 bg-blue-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Folder size={16} className="text-blue-500" />
                                        <span className="text-sm text-blue-800 font-medium">
                                            Crear en: {(() => {
                                                const getBreadcrumb = (folderId) => {
                                                    const folder = folders.find(f => f.id === folderId);
                                                    if (!folder) return 'PLANTAS';
                                                    if (folder.parent && folder.parent !== 'root') {
                                                        return getBreadcrumb(folder.parent) + ' > ' + folder.name;
                                                    }
                                                    return folder.name;
                                                };
                                                return getBreadcrumb(selectedFolder);
                                            })()}
                                        </span>
                                    </div>
                                </div>

                                {/* Nombre de la carpeta */}
                                <div>
                                    <label className="block text-sm font-medium text-primary mb-2">
                                        Nombre de la carpeta
                                    </label>
                                    <input
                                        type="text"
                                        value={folderForm.name}
                                        onChange={(e) => setFolderForm(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Ingresa el nombre de la carpeta"
                                        className="w-full p-3 border border-custom rounded-lg bg-panel text-primary"
                                        autoFocus
                                    />
                                </div>

                                {/* Botones */}
                                <div className="flex justify-end gap-3 pt-4 border-t border-custom">
                                    <button
                                        onClick={() => setShowCreateFolderModal(false)}
                                        className="px-4 py-2 text-secondary hover-bg rounded cursor-pointer"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleCreateFolder}
                                        disabled={!folderForm.name.trim() || isUploading}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer disabled:opacity-50"
                                    >
                                        {isUploading ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Creando...
                                            </>
                                        ) : (
                                            <>
                                                Crear
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de detalles del documento */}
            {showDocumentModal && selectedDocument && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-panel rounded-lg w-full max-w-2xl">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-primary">Detalles del Documento</h3>
                                <button onClick={() => setShowDocumentModal(false)} className="p-2 hover-badge-gray rounded cursor-pointer">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="relative">
                                        <FileText className="text-blue-500" size={32} />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-xl font-semibold text-primary mb-2">{selectedDocument.name}</h4>
                                        <p className="text-secondary mb-4">{selectedDocument.description}</p>

                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="font-medium text-secondary">Tamaño:</span>
                                                <span className="ml-2 text-primary">{formatFileSize(selectedDocument.size)}</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-secondary">Modificado:</span>
                                                <span className="ml-2 text-primary">{formatDate(selectedDocument.uploadedAt)}</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-secondary">Origen:</span>
                                                <span className="ml-2 text-primary">{selectedDocument.uploadedBy}</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-secondary">Tipo:</span>
                                                <span className="ml-2 text-primary">{selectedDocument.type}</span>
                                            </div>
                                        </div>

                                        {selectedDocument.isGoogleDrive && (
                                            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-blue-800 font-medium">
                                                        Archivo sincronizado desde Google Drive
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {selectedDocument.tags && selectedDocument.tags.length > 0 && (
                                            <div className="mt-4">
                                                <span className="font-medium text-secondary">Etiquetas:</span>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {selectedDocument.tags.map(tag => (
                                                        <span key={tag} className="px-2 py-1 bg-header-table text-primary text-sm rounded">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-custom">
                                    <button
                                        onClick={() => handleDownload(selectedDocument)}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 cursor-pointer"
                                    >
                                        <Download size={16} />
                                        Descargar
                                    </button>

                                    {selectedDocument.isGoogleDrive && (
                                        <button
                                            onClick={() => window.open(`https://drive.google.com/file/d/${selectedDocument.googleId}/view`, '_blank')}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
                                        >
                                            Abrir en Drive
                                        </button>
                                    )}

                                    {!selectedDocument.isGoogleDrive && (isAdmin || selectedDocument.uploadedBy === user?.username) && (
                                        <button
                                            onClick={() => {
                                                setShowDocumentModal(false);
                                                handleDelete(selectedDocument.id);
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
                                        >
                                            <Trash2 size={16} />
                                            Eliminar
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestionDocumentosPage;