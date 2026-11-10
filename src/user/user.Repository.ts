import { Repository } from '../shared/repository.js'
import { User } from './user.entity.js'
import { db } from '../shared/db/conn.js'
import { ObjectId } from 'mongodb'

const users = db.collection<User>('users')

// el email identifica al usuario: no puede repetirse
await users.createIndex({ email: 1 }, { unique: true })

// el hash de la contraseña y el token de confirmación nunca salen del repositorio (salvo para el login)
const hidePassword = { projection: { passwordHash: 0, emailToken: 0 } }

export class UserRepository implements Repository<User> {
  public async findAll(): Promise<User[] | undefined> {
    return await users.find({}, hidePassword).toArray()
  }

  public async findOne(item: { id: string }): Promise<User | undefined> {
    const _id = new ObjectId(item.id)
    return (await users.findOne({ _id }, hidePassword)) || undefined
  }

  public async findByEmail(email: string): Promise<User | undefined> {
    return (await users.findOne({ email }, hidePassword)) || undefined
  }

  // único método que devuelve el hash: lo necesita el login para comparar la contraseña
  public async findByEmailWithPassword(email: string): Promise<User | undefined> {
    return (await users.findOne({ email })) || undefined
  }

  public async add(item: User): Promise<User | undefined> {
    item._id = (await users.insertOne(item)).insertedId
    const { passwordHash, emailToken, ...user } = item
    return user as User
  }

  // marca el email como confirmado y borra el token para que el link no sirva dos veces
  public async confirmEmail(token: string): Promise<User | undefined> {
    return (
      (await users.findOneAndUpdate(
        { emailToken: token },
        { $set: { emailConfirmed: true }, $unset: { emailToken: "" } },
        { returnDocument: 'after', ...hidePassword }
      )) || undefined
    )
  }

  public async update(id: string, item: User): Promise<User | undefined> {
    const _id = new ObjectId(id)
    return (await users.findOneAndUpdate({ _id }, { $set: item }, { returnDocument: 'after', ...hidePassword })) || undefined
  }

  public async delete(item: { id: string }): Promise<User | undefined> {
    const _id = new ObjectId(item.id)
    return (await users.findOneAndDelete({ _id }, hidePassword)) || undefined
  }
}
