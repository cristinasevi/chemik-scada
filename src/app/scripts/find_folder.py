#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para encontrar el ID de la carpeta de informes diarios
"""

import requests
import json

def find_folder_id():
    """Buscar el ID de la carpeta de informes diarios"""
    
    # Usar las mismas credenciales que funcionaron
    SUPABASE_URL = "https://jfaehrygsnlzfkpzaopx.supabase.co"
    SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmYWVocnlnc25semZrcHphb3B4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTYzODEzMiwiZXhwIjoyMDY1MjE0MTMyfQ.WgfSS0Vwl-fuq-bx2U0HSyItu7pKEYVMr9e6dICezqM"
    
    try:
        print("🔍 Buscando carpetas en la base de datos...")
        
        # URL de la API para obtener carpetas
        api_url = f"{SUPABASE_URL}/rest/v1/folders"
        
        # Headers
        headers = {
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY
        }
        
        # Obtener todas las carpetas
        response = requests.get(api_url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            folders = response.json()
            print(f"✅ Encontradas {len(folders)} carpetas")
            
            print("\n📁 ESTRUCTURA DE CARPETAS:")
            print("-" * 60)
            
            # Buscar carpetas relacionadas con RETAMAR e informes
            relevant_folders = []
            
            for folder in folders:
                folder_name = folder.get('name', '').lower()
                folder_id = folder.get('id', '')
                parent_id = folder.get('parent_id', '')
                
                # Buscar carpetas relevantes
                if any(keyword in folder_name for keyword in [
                    'retamar', 'informes', 'diarios', 'automaticos', 'tecnicos'
                ]):
                    relevant_folders.append(folder)
                
                print(f"📂 {folder.get('name', 'Sin nombre')}")
                print(f"   ID: {folder_id}")
                print(f"   Parent: {parent_id}")
                print()
            
            if relevant_folders:
                print("\n🎯 CARPETAS RELEVANTES PARA INFORMES:")
                print("-" * 60)
                
                for folder in relevant_folders:
                    print(f"📁 {folder.get('name')}")
                    print(f"   🆔 ID: {folder.get('id')}")
                    print(f"   📂 Parent ID: {folder.get('parent_id')}")
                    print(f"   📝 Descripción: {folder.get('description', 'N/A')}")
                    print()
                
                # Buscar específicamente la carpeta de informes diarios
                daily_folders = [f for f in relevant_folders 
                               if 'diarios' in f.get('name', '').lower()]
                
                if daily_folders:
                    print("🎯 CARPETA PARA INFORMES DIARIOS:")
                    daily_folder = daily_folders[0]
                    print(f"   📁 Nombre: {daily_folder.get('name')}")
                    print(f"   🆔 ID: {daily_folder.get('id')}")
                    print(f"\n💡 Usa este ID en tu script:")
                    print(f"   self.FOLDER_ID = \"{daily_folder.get('id')}\"")
                    
                    return daily_folder.get('id')
            else:
                print("⚠️ No se encontraron carpetas relevantes")
                print("💡 Puedes usar 'root' como FOLDER_ID temporalmente")
                
            return None
            
        elif response.status_code == 404:
            print("❌ La tabla 'folders' no existe")
            print("💡 Puedes usar 'root' como FOLDER_ID")
            return None
        else:
            print(f"❌ Error obteniendo carpetas: {response.status_code}")
            print(f"   Respuesta: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return None


if __name__ == "__main__":
    print("🔍 BUSCADOR DE ID DE CARPETAS")
    print("=" * 40)
    
    folder_id = find_folder_id()
    
    if folder_id:
        print(f"\n✅ ID encontrado: {folder_id}")
    else:
        print("\n⚠️ Usa 'root' como FOLDER_ID por ahora")
        print("   Puedes crear la estructura de carpetas manualmente después")