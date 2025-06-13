#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de PRUEBA para subir UN archivo a Supabase - VERSIÓN CORREGIDA
"""

import os
import requests
import mimetypes
from datetime import datetime

class SimpleUploader:
    def __init__(self):
        """Configuración simple para pruebas"""
        
        # ⚠️ CONFIGURA ESTOS VALORES ⚠️
        self.SUPABASE_URL = "https://jfaehrygsnlzfkpzaopx.supabase.co"
        self.SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmYWVocnlnc25semZrcHphb3B4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYzODEzMiwiZXhwIjoyMDY1MjE0MTMyfQ.WgfSS0Vwl-fuq-bx2U0HSyItu7pKEYVMr9e6dICezqM" 
        self.BUCKET_NAME = "documents"
        
        # Archivo de prueba
        self.TEST_FILE = r"C:\SCADA\pv_reports\Prueba\PV_Informe_Diario_20250527.pdf"
        
        # Carpeta destino
        self.FOLDER_ID = "root"
        self.REMOTE_PATH = "RETAMAR"
    
    def sanitize_filename(self, filename):
        """Limpiar nombre de archivo para Storage"""
        import re
        import unicodedata
        
        # Normalizar y quitar acentos
        normalized = unicodedata.normalize('NFD', filename)
        without_accents = ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')
        
        # Reemplazar caracteres problemáticos
        sanitized = re.sub(r'[<>:"/\\|?*]', '_', without_accents)
        
        return sanitized
    
    def test_connection(self):
        """Probar conexión con Supabase - VERSIÓN CORREGIDA"""
        print("🔗 Probando conexión con Supabase...")
        
        try:
            # Probar primero con el bucket de storage
            print("   Probando acceso al Storage...")
            storage_url = f"{self.SUPABASE_URL}/storage/v1/bucket/{self.BUCKET_NAME}"
            storage_headers = {
                'Authorization': f'Bearer {self.SUPABASE_KEY}',
                'apikey': self.SUPABASE_KEY
            }
            
            storage_response = requests.get(storage_url, headers=storage_headers, timeout=10)
            
            if storage_response.status_code == 200:
                print("   ✅ Storage accesible")
            else:
                print(f"   ⚠️ Storage response: {storage_response.status_code}")
            
            # Probar acceso a la tabla documents
            print("   Probando acceso a la tabla documents...")
            url = f"{self.SUPABASE_URL}/rest/v1/documents"
            headers = {
                'Authorization': f'Bearer {self.SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'apikey': self.SUPABASE_KEY
            }
            
            # Hacer una consulta limitada
            params = {'select': 'id', 'limit': 1}
            response = requests.get(url, headers=headers, params=params, timeout=10)
            
            if response.status_code == 200:
                print("   ✅ Tabla documents accesible")
                print("✅ Conexión exitosa con Supabase")
                return True
            elif response.status_code == 401:
                print("❌ Error 401: Service Role Key inválida")
                print("💡 Verifica que estés usando la Service Role Key correcta")
                print(f"   Tu key empieza con: {self.SUPABASE_KEY[:20]}...")
                return False
            elif response.status_code == 404:
                print("❌ Error 404: Tabla 'documents' no encontrada")
                return False
            else:
                print(f"❌ Error inesperado: {response.status_code}")
                print(f"   Respuesta: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error de conexión: {e}")
            return False
    
    def check_file_exists(self):
        """Verificar que el archivo de prueba existe"""
        print(f"📁 Verificando archivo: {self.TEST_FILE}")
        
        if not os.path.exists(self.TEST_FILE):
            print("❌ Archivo no encontrado!")
            print("💡 Archivos disponibles en el directorio:")
            
            directory = os.path.dirname(self.TEST_FILE)
            if os.path.exists(directory):
                try:
                    files = os.listdir(directory)
                    pdf_files = [f for f in files if f.lower().endswith('.pdf')]
                    
                    if pdf_files:
                        print("   PDFs encontrados:")
                        for i, pdf_file in enumerate(pdf_files[:5], 1):
                            print(f"   {i}. {pdf_file}")
                        
                        if len(pdf_files) > 5:
                            print(f"   ... y {len(pdf_files) - 5} más")
                    else:
                        print("   No se encontraron archivos PDF")
                        
                except Exception as e:
                    print(f"   Error listando directorio: {e}")
            else:
                print(f"   Directorio no existe: {directory}")
            
            return False
        
        file_size = os.path.getsize(self.TEST_FILE)
        print(f"✅ Archivo encontrado - Tamaño: {file_size:,} bytes")
        return True
    
    def upload_to_storage(self, file_path, storage_path):
        """Subir archivo al Storage de Supabase - VERSIÓN CORREGIDA"""
        print(f"📤 Subiendo a Storage: {storage_path}")
        
        try:
            # Leer archivo
            with open(file_path, 'rb') as file:
                file_content = file.read()
            
            # Determinar tipo MIME
            mime_type, _ = mimetypes.guess_type(file_path)
            if not mime_type:
                mime_type = 'application/pdf'  # Default para PDFs
            
            print(f"   📄 Tipo MIME: {mime_type}")
            print(f"   📊 Tamaño: {len(file_content):,} bytes")
            
            # URL de subida
            upload_url = f"{self.SUPABASE_URL}/storage/v1/object/{self.BUCKET_NAME}/{storage_path}"
            print(f"   🔗 URL: {upload_url}")
            
            # Headers CORREGIDOS
            headers = {
                'Authorization': f'Bearer {self.SUPABASE_KEY}',
                'apikey': self.SUPABASE_KEY,
                'Content-Type': mime_type,
                'x-upsert': 'true'
            }
            
            # Subir
            response = requests.post(upload_url, data=file_content, headers=headers, timeout=30)
            
            print(f"   📡 Response status: {response.status_code}")
            
            if response.status_code in [200, 201]:
                print("✅ Subido a Storage exitosamente")
                return True
            else:
                print(f"❌ Error subiendo a Storage: {response.status_code}")
                print(f"   Respuesta: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Excepción subiendo a Storage: {e}")
            return False
    
    def register_in_database(self, file_path, storage_path):
        """Registrar archivo en la base de datos - VERSIÓN CORREGIDA"""
        print("💾 Registrando en base de datos...")
        
        try:
            filename = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)
            
            # URL pública
            public_url = f"{self.SUPABASE_URL}/storage/v1/object/public/{self.BUCKET_NAME}/{storage_path}"
            
            # Datos del documento
            document_data = {
                "name": filename,
                "original_name": filename,
                "file_path": storage_path,
                "file_url": public_url,
                "size": file_size,
                "mime_type": mimetypes.guess_type(file_path)[0] or 'application/pdf',
                "folder_id": self.FOLDER_ID,
                "uploaded_by": "Prueba Manual",
                "description": f"Archivo de prueba subido el {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                "tags": ["prueba", "test", "manual"],
                "category": "prueba",
                "plant": "RETAMAR",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            # URL de la API
            api_url = f"{self.SUPABASE_URL}/rest/v1/documents"
            
            # Headers CORREGIDOS
            headers = {
                'Authorization': f'Bearer {self.SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'apikey': self.SUPABASE_KEY,
                'Prefer': 'return=representation'
            }
            
            print(f"   🔗 API URL: {api_url}")
            print(f"   📄 Datos a insertar: {document_data['name']}")
            
            # Insertar
            response = requests.post(api_url, json=document_data, headers=headers, timeout=30)
            
            print(f"   📡 Response status: {response.status_code}")
            
            if response.status_code in [200, 201]:
                print("✅ Registrado en base de datos exitosamente")
                return True
            else:
                print(f"❌ Error registrando en BD: {response.status_code}")
                print(f"   Respuesta: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Excepción registrando en BD: {e}")
            return False
    
    def run_test(self):
        """Ejecutar prueba completa"""
        print("=" * 60)
        print("🧪 INICIANDO PRUEBA DE SUBIDA - VERSIÓN CORREGIDA")
        print("=" * 60)
        
        # 1. Verificar configuración
        print("🔍 Verificando configuración...")
        print(f"   📡 URL: {self.SUPABASE_URL}")
        print(f"   🔑 Key: {self.SUPABASE_KEY[:20]}...{self.SUPABASE_KEY[-10:]}")
        print(f"   🪣 Bucket: {self.BUCKET_NAME}")
        
        # 2. Probar conexión
        if not self.test_connection():
            return False
        
        # 3. Verificar archivo
        if not self.check_file_exists():
            return False
        
        # 4. Preparar nombres
        filename = os.path.basename(self.TEST_FILE)
        sanitized_name = self.sanitize_filename(filename)
        storage_path = f"{self.REMOTE_PATH}/{sanitized_name}"
        
        print(f"\n📝 Información del archivo:")
        print(f"   📄 Nombre original: {filename}")
        print(f"   📄 Nombre sanitizado: {sanitized_name}")
        print(f"   📂 Ruta en storage: {storage_path}")
        
        # 5. Subir a Storage
        print(f"\n🚀 Paso 1: Subir a Storage...")
        if not self.upload_to_storage(self.TEST_FILE, storage_path):
            return False
        
        # 6. Registrar en BD
        print(f"\n🚀 Paso 2: Registrar en base de datos...")
        if not self.register_in_database(self.TEST_FILE, storage_path):
            print("⚠️ Archivo subido a Storage pero no registrado en BD")
            return False
        
        # 7. Éxito total
        print("\n" + "=" * 60)
        print("🎉 ¡PRUEBA EXITOSA!")
        print("=" * 60)
        print(f"📁 Archivo subido: {filename}")
        print(f"🔗 URL pública: {self.SUPABASE_URL}/storage/v1/object/public/{self.BUCKET_NAME}/{storage_path}")
        print("✅ El archivo debería aparecer en tu plataforma")
        
        return True


def main():
    """Función principal de prueba"""
    
    print("🧪 SCRIPT DE PRUEBA - SUBIDA INDIVIDUAL")
    print("📝 VERSIÓN CORREGIDA CON MEJOR DEBUGGING")
    print()
    
    # Crear uploader y ejecutar prueba directamente
    uploader = SimpleUploader()
    success = uploader.run_test()
    
    if success:
        print("\n💡 SIGUIENTES PASOS:")
        print("   1. Ve a tu plataforma web y verifica que aparece el archivo")
        print("   2. Si aparece, ¡la configuración es correcta!")
        print("   3. Ahora podemos configurar el sistema automático")
    else:
        print("\n🔧 DEBUG:")
        print("   1. Revisa los mensajes de error detallados arriba")
        print("   2. Verifica especialmente la Service Role Key")
        print("   3. Comprueba que el bucket 'documents' existe en Supabase Storage")


if __name__ == "__main__":
    main()