#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para subir automáticamente el informe diario DEL DÍA ANTERIOR
Ejecutar todos los días a las 7:00 AM
"""

import os
import re
import json
import requests
import mimetypes
import logging
from datetime import datetime, timedelta
from pathlib import Path

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('daily_uploader.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

class DailyReportUploader:
    def __init__(self):
        """Configuración para subir informes diarios"""
        
        # CONFIGURACIÓN - Usar las mismas credenciales que funcionaron
        self.SUPABASE_URL = "https://jfaehrygsnlzfkpzaopx.supabase.co"
        self.SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmYWVocnlnc25semZrcHphb3B4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYzODEzMiwiZXhwIjoyMDY1MjE0MTMyfQ.WgfSS0Vwl-fuq-bx2U0HSyItu7pKEYVMr9e6dICezqM"
        self.BUCKET_NAME = "documents"
        
        # CONFIGURACIÓN DE CARPETAS
        self.SOURCE_DIRECTORY = r"C:\SCADA\pv_reports\Prueba"
        self.REMOTE_PATH = "RETAMAR/2_INFORMES/2_1_Informes_automaticos/2_1_1_Informes_tecnicos/2_1_1_1_Informes_diarios"
        
        # CONFIGURACIÓN DEL ARCHIVO
        self.FILE_PATTERNS = [
            re.compile(r'PV_Informe_Diario_(\d{8})\.pdf$', re.IGNORECASE),           # YYYYMMDD
            re.compile(r'PV_Informe_Diario_(\d{4}-\d{2}-\d{2})\.pdf$', re.IGNORECASE), # YYYY-MM-DD
            re.compile(r'PV_Informe_Diario_(\d{4}\d{2}\d{2})\.pdf$', re.IGNORECASE),   # YYYYMMDD sin guiones
        ]
        
        # METADATOS
        self.FOLDER_ID = "d2ec4090-da60-4c45-a02b-2fc69c2c6086" # Informes diarios técnicos
        self.PLANT = "RETAMAR"
        self.CATEGORY = "informe_diario"
        self.TAGS = ["retamar", "informe", "diario", "automatico", "pv"]
        
        # ARCHIVO DE LOG PARA TRACKING
        self.UPLOADED_LOG = "uploaded_daily_reports.json"
        self.uploaded_files = self.load_uploaded_log()
    
    def load_uploaded_log(self):
        """Cargar registro de archivos ya subidos"""
        try:
            if os.path.exists(self.UPLOADED_LOG):
                with open(self.UPLOADED_LOG, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logging.warning(f"Error cargando log: {e}")
        return {}
    
    def save_uploaded_log(self):
        """Guardar registro de archivos subidos"""
        try:
            with open(self.UPLOADED_LOG, 'w', encoding='utf-8') as f:
                json.dump(self.uploaded_files, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logging.error(f"Error guardando log: {e}")
    
    def sanitize_filename(self, filename):
        """Limpiar nombre de archivo para Storage"""
        import unicodedata
        
        normalized = unicodedata.normalize('NFD', filename)
        without_accents = ''.join(c for c in normalized if unicodedata.category(c) != 'Mn')
        sanitized = re.sub(r'[<>:"/\\|?*]', '_', without_accents)
        
        return sanitized
    
    def parse_date_from_filename(self, filename):
        """Extraer fecha del nombre del archivo"""
        for pattern in self.FILE_PATTERNS:
            match = pattern.match(filename)
            if match:
                date_str = match.group(1)
                
                try:
                    if len(date_str) == 8:  # YYYYMMDD
                        return datetime.strptime(date_str, '%Y%m%d')
                    elif len(date_str) == 10:  # YYYY-MM-DD
                        return datetime.strptime(date_str, '%Y-%m-%d')
                except ValueError:
                    continue
        return None
    
    def find_daily_reports(self):
        """Buscar todos los informes diarios en el directorio"""
        reports = []
        
        try:
            if not os.path.exists(self.SOURCE_DIRECTORY):
                logging.error(f"Directorio fuente no encontrado: {self.SOURCE_DIRECTORY}")
                return reports
            
            for filename in os.listdir(self.SOURCE_DIRECTORY):
                file_path = os.path.join(self.SOURCE_DIRECTORY, filename)
                
                if not os.path.isfile(file_path):
                    continue
                
                file_date = self.parse_date_from_filename(filename)
                if file_date:
                    file_info = {
                        'path': file_path,
                        'filename': filename,
                        'date': file_date,
                        'date_str': file_date.strftime('%Y-%m-%d'),
                        'size': os.path.getsize(file_path),
                        'modified': datetime.fromtimestamp(os.path.getmtime(file_path))
                    }
                    reports.append(file_info)
        
        except Exception as e:
            logging.error(f"Error escaneando directorio: {e}")
        
        return reports
    
    def get_yesterday_report(self):
        """Obtener el informe del DÍA ANTERIOR específicamente"""
        yesterday = datetime.now() - timedelta(days=1)
        yesterday_str = yesterday.strftime('%Y-%m-%d')
        
        logging.info(f"Buscando informe del día anterior: {yesterday_str}")
        
        reports = self.find_daily_reports()
        
        if not reports:
            logging.error(f"No se encontraron informes diarios en {self.SOURCE_DIRECTORY}")
            return None
        
        # Buscar específicamente el informe de ayer
        yesterday_reports = [r for r in reports if r['date_str'] == yesterday_str]
        
        if not yesterday_reports:
            logging.warning(f"No se encontró informe para el día {yesterday_str}")
            
            # Mostrar informes disponibles para debugging
            logging.info("Informes disponibles:")
            for report in sorted(reports, key=lambda x: x['date'], reverse=True)[:7]:
                logging.info(f"{report['filename']} - {report['date_str']}")
            
            # Buscar informes de los últimos 3 días como fallback
            fallback_days = 3
            cutoff_date = datetime.now() - timedelta(days=fallback_days)
            recent_reports = [r for r in reports if r['date'] >= cutoff_date]
            
            if recent_reports:
                latest = max(recent_reports, key=lambda x: x['date'])
                logging.warning(f"Usando informe más reciente como fallback: {latest['filename']}")
                return latest
            
            return None
        
        # Si hay múltiples informes del mismo día, tomar el más reciente por hora de modificación
        yesterday_report = max(yesterday_reports, key=lambda x: x['modified'])
        
        logging.info(f"Informe del día anterior encontrado:")
        logging.info(f"   Archivo: {yesterday_report['filename']}")
        logging.info(f"   Fecha: {yesterday_report['date_str']}")
        logging.info(f"   Tamaño: {yesterday_report['size']:,} bytes")
        logging.info(f"   Modificado: {yesterday_report['modified'].strftime('%Y-%m-%d %H:%M:%S')}")
        
        return yesterday_report
    
    def is_already_uploaded(self, report_info):
        """Verificar si el archivo ya fue subido"""
        file_key = f"{report_info['filename']}_{report_info['size']}_{report_info['date_str']}"
        return file_key in self.uploaded_files
    
    def mark_as_uploaded(self, report_info, storage_path):
        """Marcar archivo como subido"""
        file_key = f"{report_info['filename']}_{report_info['size']}_{report_info['date_str']}"
        self.uploaded_files[file_key] = {
            'filename': report_info['filename'],
            'storage_path': storage_path,
            'uploaded_at': datetime.now().isoformat(),
            'file_date': report_info['date_str'],
            'size': report_info['size']
        }
        self.save_uploaded_log()
    
    def upload_to_storage(self, file_path, storage_path):
        """Subir archivo al Storage de Supabase"""
        logging.info(f"Subiendo a Storage: {storage_path}")
        
        try:
            with open(file_path, 'rb') as file:
                file_content = file.read()
            
            upload_url = f"{self.SUPABASE_URL}/storage/v1/object/{self.BUCKET_NAME}/{storage_path}"
            
            headers = {
                'Authorization': f'Bearer {self.SUPABASE_KEY}',
                'apikey': self.SUPABASE_KEY,
                'Content-Type': 'application/pdf',
                'x-upsert': 'true'
            }
            
            response = requests.post(upload_url, data=file_content, headers=headers, timeout=60)
            
            if response.status_code in [200, 201]:
                logging.info("Subido a Storage exitosamente")
                return True
            else:
                logging.error(f"Error subiendo a Storage: {response.status_code}")
                logging.error(f"   Respuesta: {response.text}")
                return False
                
        except Exception as e:
            logging.error(f"Excepción subiendo a Storage: {e}")
            return False
    
    def register_in_database(self, report_info, storage_path):
        """Registrar archivo en la base de datos"""
        logging.info("Registrando en base de datos...")
        
        try:
            public_url = f"{self.SUPABASE_URL}/storage/v1/object/public/{self.BUCKET_NAME}/{storage_path}"
            
            document_data = {
                "name": report_info['filename'],
                "original_name": report_info['filename'],
                "file_path": storage_path,
                "file_url": public_url,
                "size": report_info['size'],
                "mime_type": "application/pdf",
                "folder_id": self.FOLDER_ID,
                "uploaded_by": "Sistema Automático Diario",
                "description": f"Informe diario PV del {report_info['date_str']} - Subido automáticamente",
                "tags": self.TAGS,
                "category": self.CATEGORY,
                "plant": self.PLANT,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            api_url = f"{self.SUPABASE_URL}/rest/v1/documents"
            
            headers = {
                'Authorization': f'Bearer {self.SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'apikey': self.SUPABASE_KEY,
                'Prefer': 'return=representation'
            }
            
            response = requests.post(api_url, json=document_data, headers=headers, timeout=30)
            
            if response.status_code in [200, 201]:
                logging.info("Registrado en base de datos exitosamente")
                return True
            else:
                logging.error(f"Error registrando en BD: {response.status_code}")
                logging.error(f"   Respuesta: {response.text}")
                return False
                
        except Exception as e:
            logging.error(f"Excepción registrando en BD: {e}")
            return False
    
    def upload_yesterday_report(self, force_upload=False):
        """Subir el informe del día anterior"""
        logging.info("=" * 70)
        logging.info("SUBIDA AUTOMÁTICA DE INFORME DIARIO - DÍA ANTERIOR")
        logging.info("=" * 70)
        
        # 1. Buscar informe de ayer
        yesterday_report = self.get_yesterday_report()
        
        if not yesterday_report:
            logging.error("No se encontró informe del día anterior")
            return False
        
        # 2. Verificar si ya fue subido
        if not force_upload and self.is_already_uploaded(yesterday_report):
            logging.info(f"El archivo {yesterday_report['filename']} ya fue subido anteriormente")
            return True
        
        # 3. Preparar ruta de destino
        sanitized_name = self.sanitize_filename(yesterday_report['filename'])
        storage_path = f"{self.REMOTE_PATH}/{sanitized_name}"
        
        logging.info(f"Preparando subida:")
        logging.info(f"   Archivo: {yesterday_report['filename']}")
        logging.info(f"   Destino: {storage_path}")
        logging.info(f"   Fecha del informe: {yesterday_report['date_str']}")
        
        # 4. Subir a Storage
        if not self.upload_to_storage(yesterday_report['path'], storage_path):
            return False
        
        # 5. Registrar en BD
        if not self.register_in_database(yesterday_report, storage_path):
            logging.warning("Archivo subido a Storage pero no registrado en BD")
            return False
        
        # 6. Marcar como subido
        self.mark_as_uploaded(yesterday_report, storage_path)
        
        # 7. Éxito
        logging.info("=" * 70)
        logging.info("¡INFORME DIARIO SUBIDO EXITOSAMENTE!")
        logging.info("=" * 70)
        logging.info(f"Archivo: {yesterday_report['filename']}")
        logging.info(f"Ubicación: {self.REMOTE_PATH}")
        logging.info(f"URL: {self.SUPABASE_URL}/storage/v1/object/public/{self.BUCKET_NAME}/{storage_path}")
        
        return True


def main():
    """Función principal para ejecución automática"""
    import sys
    
    logging.info("INICIO DE SUBIDA AUTOMÁTICA - INFORME DIARIO")
    
    try:
        uploader = DailyReportUploader()
        
        # Verificar si se fuerza la subida
        force_upload = len(sys.argv) > 1 and sys.argv[1].lower() == "force"
        
        success = uploader.upload_yesterday_report(force_upload=force_upload)
        
        if success:
            logging.info("Proceso completado exitosamente")
            sys.exit(0)
        else:
            logging.error("Proceso falló")
            sys.exit(1)
            
    except Exception as e:
        logging.error(f"Error crítico: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()