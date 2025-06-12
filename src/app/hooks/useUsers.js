import { useState, useEffect } from 'react'
import { userService } from '../lib/supabase'

export const useUsers = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Cargar usuarios
  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { data, error: fetchError } = await userService.getAllUsers()
      
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setUsers(data || [])
      }
    } catch (err) {
      setError('Error cargando usuarios')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Crear usuario
  const createUser = async (userData) => {
    try {
      const result = await userService.createUser(userData)
      
      if (result.success) {
        await loadUsers() // Recargar lista
        return { success: true, data: result.data }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Actualizar usuario
  const updateUser = async (userId, userData) => {
    try {
      const { data, error } = await userService.updateUser(userId, userData)
      
      if (error) {
        return { success: false, error: error.message }
      }
      
      // Actualizar estado local
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId ? { ...user, ...data } : user
        )
      )
      
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Eliminar usuario
  const deleteUser = async (userId) => {
    try {
      const result = await userService.deleteUser(userId)
      
      if (result.success) {
        // Actualizar estado local
        setUsers(prevUsers => prevUsers.filter(user => user.id !== userId))
        return { success: true }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Verificar disponibilidad de nombre de usuario
  const checkUsernameAvailable = async (nombreUsuario, excludeUserId = null) => {
    try {
      const { available, error } = await userService.checkUsernameAvailable(
        nombreUsuario, 
        excludeUserId
      )
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found (username available)
        return { available: false, error: error.message }
      }
      
      return { available, error: null }
    } catch (error) {
      return { available: false, error: error.message }
    }
  }

  // Cargar usuarios al montar el componente
  useEffect(() => {
    loadUsers()
  }, [])

  return {
    users,
    loading,
    error,
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    checkUsernameAvailable
  }
}