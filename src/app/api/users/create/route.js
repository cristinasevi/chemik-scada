import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Cliente admin (con Service Role Key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Esta clave SOLO debe estar en el servidor
)

export async function POST(request) {
  try {
    const userData = await request.json()
    
    // Validar datos requeridos
    if (!userData.email || !userData.nombre || !userData.nombre_usuario) {
      return NextResponse.json(
        { success: false, error: 'Datos requeridos faltantes' },
        { status: 400 }
      )
    }

    // Verificar que el usuario que hace la petición es admin
    // (aquí deberías verificar el token de autorización)
    
    // Crear usuario en auth con Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.password || 'TempPassword123!', // Contraseña temporal
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        nombre: userData.nombre,
        nombre_usuario: userData.nombre_usuario,
        rol: userData.rol || 'user',
        notify_alarms: userData.notify_alarms?.toString() || 'true',
        plantas_asignadas: userData.plantas_asignadas?.join(',') || '',
        permissions: getDefaultPermissions(userData.rol || 'user').join(',')
      }
    })
    
    if (authError) {
      console.error('Error creando usuario en auth:', authError)
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: authData.user,
      message: 'Usuario creado exitosamente'
    })

  } catch (error) {
    console.error('Error en crear usuario:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// Función para obtener permisos por defecto según rol
function getDefaultPermissions(rol) {
  switch (rol) {
    case 'admin':
      return ['dashboard', 'users', 'plants', 'reports', 'settings']
    case 'cliente':
      return ['dashboard', 'plants', 'reports', 'settings']
    default:
      return ['dashboard']
  }
}