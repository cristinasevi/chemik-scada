import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Funciones para gestión de usuarios
export const userService = {
  // Obtener todos los usuarios (solo admins)
  async getAllUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    
    return { data, error }
  },

  // Obtener perfil del usuario actual
  async getCurrentUserProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return { data: null, error: 'No user found' }
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      
    return { data, error }
  },

  // Verificar si nombre de usuario está disponible
  async checkUsernameAvailable(nombreUsuario, excludeUserId = null) {
    let query = supabase
      .from('profiles')
      .select('nombre_usuario')
      .eq('nombre_usuario', nombreUsuario)
    
    if (excludeUserId) {
      query = query.neq('id', excludeUserId)
    }
    
    const { data, error } = await query.single()
    
    return { available: !data, error }
  },

  // Crear nuevo usuario (requiere Admin API - solo desde servidor)
  async createUser(userData) {
    // Esta función debe ser llamada desde un endpoint de API
    // porque requiere Service Role Key
    const response = await fetch('/api/users/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData)
    })
    
    return await response.json()
  },

  // Actualizar usuario existente
  async updateUser(userId, userData) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...userData,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()
    
    return { data, error }
  },

  // Eliminar usuario (requiere Admin API - solo desde servidor)
  async deleteUser(userId) {
    const response = await fetch('/api/users/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId })
    })
    
    return await response.json()
  },

  // Actualizar configuración de notificaciones
  async updateNotificationSettings(userId, notifyAlarms) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        notify_alarms: notifyAlarms,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()
      
    return { data, error }
  },

  // Verificar permisos del usuario
  async hasPermission(permission) {
    const { data: profile } = await this.getCurrentUserProfile()
    return profile?.permissions?.includes(permission) || false
  },

  // Asignar plantas a usuario
  async assignPlantsToUser(userId, plantas) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        plantas_asignadas: plantas,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()
      
    return { data, error }
  },

  // Agregar planta a usuario existente
  async addPlantToUser(userId, nuevaPlanta) {
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('plantas_asignadas')
      .eq('id', userId)
      .single()
      
    if (fetchError) return { data: null, error: fetchError }
    
    const plantasActuales = profile.plantas_asignadas || []
    const plantasActualizadas = [...plantasActuales, nuevaPlanta]
    
    return await this.assignPlantsToUser(userId, plantasActualizadas)
  }
}