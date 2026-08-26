export interface UserAuthDTO {
    email: string
    fullName: string
    isActive: boolean
    roles: string[]
    deleted: number
    isVerified?: boolean
    perfilCompleto?: boolean
    telefono?: string
}
