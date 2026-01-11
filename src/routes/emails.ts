import { FastifyInstance } from 'fastify';
import { createConnection } from '../config/database';
import ExcelJS from 'exceljs';

interface EmailRow {
  id: number;
  email: string;
  password: string;
  app_password: string;
  secret_key: string;
  recovery_email: string;
}

export async function emailRoutes(fastify: FastifyInstance) {
  // GET /api/emails - Lấy danh sách emails
  fastify.get('/', async (request, reply) => {
    const { limit = 100, offset = 0 } = request.query as { limit?: number; offset?: number };

    try {
      const db = await createConnection();
      const [rows] = await db.execute(
        'SELECT id, email, password, app_password, secret_key, recovery_email FROM gmail ORDER BY id DESC LIMIT ? OFFSET ?',
        [Number(limit), Number(offset)]
      );

      const [countResult] = await db.execute('SELECT COUNT(*) as total FROM gmail');
      const total = (countResult as any)[0].total;

      await db.end();

      return {
        status: 'success',
        data: rows,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total,
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ status: 'error', message: 'Database error' });
    }
  });

  // GET /api/emails/excel - Xuất Excel
  fastify.get('/excel', async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const limitNum = parseInt(limit || '');

    if (isNaN(limitNum) || limitNum <= 0) {
      return reply.status(400).send({ status: 'error', message: 'Limit phải là số nguyên dương' });
    }

    try {
      const db = await createConnection();
      const [rows] = await db.execute(
        'SELECT id, email, password, app_password, secret_key, recovery_email FROM gmail ORDER BY id DESC LIMIT ?',
        [limitNum]
      );
      await db.end();

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Emails');

      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Email', key: 'email', width: 40 },
        { header: 'Password', key: 'password', width: 25 },
        { header: 'App Password', key: 'app_password', width: 25 },
        { header: '2FA', key: 'secret_key', width: 40 },
        { header: 'Recovery Email', key: 'recovery_email', width: 40 },
      ];

      (rows as EmailRow[]).forEach((row) => worksheet.addRow(row));

      const buffer = await workbook.xlsx.writeBuffer();

      reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', 'attachment; filename="emails.xlsx"')
        .send(buffer);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ status: 'error', message: 'Lỗi server' });
    }
  });

  // GET /api/emails/:id - Lấy 1 email theo ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const db = await createConnection();
      const [rows] = await db.execute(
        'SELECT id, email, password, app_password, secret_key, recovery_email FROM gmail WHERE id = ?',
        [id]
      );
      await db.end();

      const data = rows as EmailRow[];
      if (data.length === 0) {
        return reply.status(404).send({ status: 'error', message: 'Email không tồn tại' });
      }

      return { status: 'success', data: data[0] };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ status: 'error', message: 'Database error' });
    }
  });

  // POST /api/emails - Thêm email mới
  fastify.post('/', async (request, reply) => {
    const { email, password, app_password, secret_key, recovery_email } = request.body as EmailRow;

    if (!email || !password) {
      return reply.status(400).send({ status: 'error', message: 'Email và password là bắt buộc' });
    }

    try {
      const db = await createConnection();
      const [result] = await db.execute(
        'INSERT INTO gmail (email, password, app_password, secret_key, recovery_email) VALUES (?, ?, ?, ?, ?)',
        [email, password, app_password || null, secret_key || null, recovery_email || null]
      );
      await db.end();

      return reply.status(201).send({
        status: 'success',
        message: 'Thêm email thành công',
        id: (result as any).insertId,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ status: 'error', message: 'Database error' });
    }
  });

  // PUT /api/emails/:id - Cập nhật email
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { email, password, app_password, secret_key, recovery_email } = request.body as EmailRow;

    try {
      const db = await createConnection();
      await db.execute(
        'UPDATE gmail SET email = ?, password = ?, app_password = ?, secret_key = ?, recovery_email = ? WHERE id = ?',
        [email, password, app_password, secret_key, recovery_email, id]
      );
      await db.end();

      return { status: 'success', message: 'Cập nhật thành công' };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ status: 'error', message: 'Database error' });
    }
  });

  // DELETE /api/emails/:id - Xóa email
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const db = await createConnection();
      await db.execute('DELETE FROM gmail WHERE id = ?', [id]);
      await db.end();

      return { status: 'success', message: 'Xóa thành công' };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ status: 'error', message: 'Database error' });
    }
  });
}
