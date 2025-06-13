#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para subir automáticamente el informe mensual más reciente
Ejecutar el DÍA 1 de cada mes a las 7:15 AM
Sube a: Informes Técnicos E Informes Clientes
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
        logging.FileHandler('monthly_uploader.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

class MonthlyReportUploader:
    def __init__(self):
        """Configuración para subir informes mensuales"""
        
        # CONFIGURACIÓN - Credenciales Supabase
        self.SUPABASE_URL = "https://jfaehrygsnlzfkpzaopx.supabase.co"
        self.SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmYWVocnlnc25semZrcHphb3B4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYzODEzMiwiZXhwIjoyMDY1MjE0MTMyfQ.WgfSS0Vwl-fuq-bx2U0HSyItu7pKEYVMr9e6dICezqM"
        self.BUCKET_NAME = "documents"
        
        # CONFIGURACIÓN DE CARPETAS
        self.SOURCE_DIRECTORY = r"C:\SCADA\pv_reports\Prueba"
        
        # RUTAS DE DESTINO - DOBLE SUBIDA
        self.REMOTE_PATHS = {
            'tecnicos': "RETAMAR/2_INFORMES/2_1_Informes_automaticos/2_1_1_Informes_tecnicos/2_1_1_3_Informes_mensuales",
            'clientes': "RETAMAR/2_INFORMES/2_1_Informes_automaticos/2_1_2_Informes_clientes/2_1_2_3_Informes_mensuales"
        }
        
        # CONFIGURACIÓN DEL ARCHIVO MENSUAL
        self.FILE_PATTERNS = [
            re.compile(r'PV_Informe_Mensual_(\d{8})\.pdf$', re.IGNORECASE),           # YYYYMMDD
            re.compile(r'PV_Informe_Mensual_(\d{4}-\d{2}-\d{2})\.pdf$', re.IGNORECASE), # YYYY-MM-DD
            re.compile(r'PV_Informe_Mensual_(\d{4}\d{2}\d{2})\.pdf$', re.IGNORECASE),   # YYYYMMDD sin guiones
            re.compile(r'PV_Informe_Mensual_(\d{4})(\d{2})\.pdf$', re.IGNORECASE),      # YYYYMM
            re.compile(r'PV_Informe_Mensual_(\d{4})-(\d{2})\.pdf$', re.IGNORECASE),     # YYYY-MM
        ]
        
        # METADATOS
        self.FOLDER_IDS = {
            'tecnicos': "bf31e8fa-dc4f-4b73-b2e4-177fb00b3a8c",  # Informes mensuales técnicos
            'clientes': "25b9b835-f4af-4a37-9667-567fdef4c477"   # Informes mensuales clientes
        }
        self.PLANT = "RETAMAR"
        self.CATEGORY = "informe_mensual"
        self.TAGS = ["retamar", "informe", "mensual", "automatico", "pv"]
        
        # ARCHIVO DE LOG PARA TRACKING
        self.UPLOADED_LOG = "uploaded_monthly_reports.json"
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
        """Extraer fecha del nombre del archivo mensual"""
        for pattern in self.FILE_PATTERNS:
            match = pattern.match(filename)
            if match:
                groups = match.groups()
                
                try:
                    if len(groups) == 1:  # Formato YYYYMMDD o YYYY-MM-DD
                        date_str = groups[0]
                        if len(date_str) == 8:  # YYYYMMDD
                            return datetime.strptime(date_str, '%Y%m%d')
                        elif len(date_str) == 10:  # YYYY-MM-DD
                            return datetime.strptime(date_str, '%Y-%m-%d')
                    elif len(groups) == 2:  # Formato YYYYMM o YYYY-MM
                        year, month = groups
                        # Para informes mensuales, usar el último día del mes
                        if int(month) == 12:
                            next_month = datetime(int(year) + 1, 1, 1)
                        else:
                            next_month = datetime(int(year), int(month) + 1, 1)
                        last_day = next_month - timedelta(days=1)
                        return last_day
                except ValueError:
                    continue
        return None
    
    def find_monthly_reports(self):
        """Buscar todos los informes mensuales en el directorio"""
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
                        'month_str': file_date.strftime('%Y-%m'),
                        'size': os.path.getsize(file_path),
                        'modified': datetime.fromtimestamp(os.path.getmtime(file_path))
                    }
                    reports.append(file_info)
        
        except Exception as e:
            logging.error(f"Error escaneando directorio: {e}")
        
        return reports
    
    def get_last_month_report(self):
        """Obtener el informe del MES ANTERIOR"""
        # Calcular el mes anterior
        today = datetime.now()
        first_day_this_month = today.replace(day=1)
        last_month = first_day_this_month - timedelta(days=1)
        last_month_str = last_month.strftime('%Y-%m')
        
        logging.info(f"Buscando informe mensual del mes anterior: {last_month_str}")
        
        reports = self.find_monthly_reports()
        
        if not reports:
            logging.error(f"No se encontraron informes mensuales en {self.SOURCE_DIRECTORY}")
            return None
        
        # Filtrar informes del mes anterior
        last_month_reports = [
            r for r in reports 
            if r['month_str'] == last_month_str
        ]
        
        if not last_month_reports:
            logging.warning(f"No se encontró informe para el mes {last_month_str}")
            logging.info("Informes mensuales disponibles:")
            for report in sorted(reports, key=lambda x: x['date'], reverse=True)[:5]:
                logging.info(f"  {report['filename']} - {report['month_str']}")
            
            # Buscar el más reciente como fallback
            if reports:
                latest = max(reports, key=lambda x: x['date'])
                logging.warning(f"Usando informe más reciente como fallback: {latest['filename']}")
                return latest
            
            return None
        
        # Si hay múltiples informes del mes, tomar el más reciente
        monthly_report = max(last_month_reports, key=lambda x: x['date'])
        
        logging.info(f"Informe mensual encontrado:")
        logging.info(f"   Archivo: {monthly_report['filename']}")
        logging.info(f"   Fecha: {monthly_report['date_str']}")
        logging.info(f"   Tamaño: {monthly_report['size']:,} bytes")
        logging.info(f"   Modificado: {monthly_report['modified'].strftime('%Y-%m-%d %H:%M:%S')}")
        
        return monthly_report
    
    def is_already_uploaded(self, report_info, destination_type):
        """Verificar si el archivo ya fue subido a un destino específico"""
        file_key = f"{report_info['filename']}_{report_info['size']}_{report_info['month_str']}_{destination_type}"
        return file_key in self.uploaded_files
    
    def mark_as_uploaded(self, report_info, storage_path, destination_type):
        """Marcar archivo como subido para un destino específico"""
        file_key = f"{report_info['filename']}_{report_info['size']}_{report_info['month_str']}_{destination_type}"
        self.uploaded_files[file_key] = {
            'filename': report_info['filename'],
            'storage_path': storage_path,
            'uploaded_at': datetime.now().isoformat(),
            'file_date': report_info['date_str'],
            'month': report_info['month_str'],
            'size': report_info['size'],
            'destination': destination_type
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
    
    def register_in_database(self, report_info, storage_path, destination_type):
        """Registrar archivo en la base de datos"""
        logging.info(f"Registrando en base de datos - {destination_type}...")
        
        try:
            public_url = f"{self.SUPABASE_URL}/storage/v1/object/public/{self.BUCKET_NAME}/{storage_path}"
            
            # Determinar uploaded_by según el destino
            uploaded_by = f"Sistema Automático Mensual - {destination_type.title()}"
            description = f"Informe mensual PV del {report_info['month_str']} - Subido automáticamente el día 1 a {destination_type}"
            
            document_data = {
                "name": report_info['filename'],
                "original_name": report_info['filename'],
                "file_path": storage_path,
                "file_url": public_url,
                "size": report_info['size'],
                "mime_type": "application/pdf",
                "folder_id": self.FOLDER_IDS[destination_type],
                "uploaded_by": uploaded_by,
                "description": description,
                "tags": self.TAGS + [destination_type],
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
                logging.info(f"Registrado en base de datos exitosamente - {destination_type}")
                return True
            else:
                logging.error(f"Error registrando en BD - {destination_type}: {response.status_code}")
                logging.error(f"   Respuesta: {response.text}")
                return False
                
        except Exception as e:
            logging.error(f"Excepción registrando en BD - {destination_type}: {e}")
            return False
    
    def upload_to_destination(self, report_info, destination_type, force_upload=False):
        """Subir a un destino específico (técnicos o clientes)"""
        
        # Verificar si ya fue subido a este destino
        if not force_upload and self.is_already_uploaded(report_info, destination_type):
            logging.info(f"El archivo ya fue subido a {destination_type} anteriormente")
            return True
        
        # Preparar ruta de destino
        sanitized_name = self.sanitize_filename(report_info['filename'])
        storage_path = f"{self.REMOTE_PATHS[destination_type]}/{sanitized_name}"
        
        logging.info(f"Subiendo a {destination_type.upper()}:")
        logging.info(f"   Archivo: {report_info['filename']}")
        logging.info(f"   Destino: {storage_path}")
        
        # Subir a Storage
        if not self.upload_to_storage(report_info['path'], storage_path):
            return False
        
        # Registrar en BD
        if not self.register_in_database(report_info, storage_path, destination_type):
            logging.warning(f"Archivo subido a Storage pero no registrado en BD - {destination_type}")
            return False
        
        # Marcar como subido
        self.mark_as_uploaded(report_info, storage_path, destination_type)
        
        logging.info(f"Subida a {destination_type} completada exitosamente")
        return True
    
    def upload_monthly_report(self, force_upload=False):
        """Subir el informe mensual del mes anterior a AMBOS destinos"""
        logging.info("=" * 70)
        logging.info("SUBIDA AUTOMÁTICA DE INFORME MENSUAL - DÍA 1 a las 7:15")
        logging.info("DESTINOS: Informes Técnicos E Informes Clientes")
        logging.info("=" * 70)
        
        # Verificar que es día 1 del mes
        today = datetime.now()
        if today.day != 1 and not force_upload:
            logging.warning(f"Hoy es día {today.day}, pero se espera día 1 del mes")
            logging.info("Usa force_upload=True para ejecutar en cualquier día")
            return False
        
        # 1. Buscar informe del mes anterior
        monthly_report = self.get_last_month_report()
        
        if not monthly_report:
            logging.error("No se encontró informe del mes anterior")
            return False
        
        logging.info(f"Preparando DOBLE subida:")
        logging.info(f"   Archivo: {monthly_report['filename']}")
        logging.info(f"   Mes del informe: {monthly_report['month_str']}")
        
        # 2. Subir a AMBOS destinos
        success_tecnicos = self.upload_to_destination(monthly_report, 'tecnicos', force_upload)
        success_clientes = self.upload_to_destination(monthly_report, 'clientes', force_upload)
        
        # 3. Verificar resultados
        if success_tecnicos and success_clientes:
            logging.info("=" * 70)
            logging.info("INFORME MENSUAL SUBIDO EXITOSAMENTE A AMBOS DESTINOS!")
            logging.info("=" * 70)
            logging.info(f"Archivo: {monthly_report['filename']}")
            logging.info(f"Ubicación 1: {self.REMOTE_PATHS['tecnicos']}")
            logging.info(f"Ubicación 2: {self.REMOTE_PATHS['clientes']}")
            return True
        elif success_tecnicos or success_clientes:
            logging.warning("SUBIDA PARCIAL: Solo se completó uno de los destinos")
            logging.warning(f"Técnicos: {'OK' if success_tecnicos else 'FALLO'}")
            logging.warning(f"Clientes: {'OK' if success_clientes else 'FALLO'}")
            return False
        else:
            logging.error("FALLO COMPLETO: No se pudo subir a ningún destino")
            return False


def main():
    """Función principal para ejecución automática"""
    import sys
    
    logging.info("INICIO DE SUBIDA AUTOMÁTICA - INFORME MENSUAL DOBLE")
    
    try:
        uploader = MonthlyReportUploader()
        
        # Verificar si se fuerza la subida
        force_upload = len(sys.argv) > 1 and sys.argv[1].lower() == "force"
        
        success = uploader.upload_monthly_report(force_upload=force_upload)
        
        if success:
            logging.info("Proceso mensual completado exitosamente")
            sys.exit(0)
        else:
            logging.error("Proceso mensual falló")
            sys.exit(1)
            
    except Exception as e:
        logging.error(f"Error crítico en proceso mensual: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()