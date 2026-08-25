import { NextResponse } from 'next/server';
import { createPool } from '../../../lib/pools';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, goalAmount, deadline, organizerAddress, organizerUserId } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (
      !goalAmount ||
      typeof goalAmount !== 'string' ||
      isNaN(Number(goalAmount)) ||
      Number(goalAmount) <= 0
    ) {
      return NextResponse.json(
        { error: 'Goal amount must be a positive decimal string' },
        { status: 400 }
      );
    }

    if (
      !organizerAddress ||
      typeof organizerAddress !== 'string' ||
      !organizerAddress.startsWith('G') ||
      organizerAddress.length !== 56
    ) {
      return NextResponse.json({ error: 'Invalid organizer address' }, { status: 400 });
    }

    if (!organizerUserId || typeof organizerUserId !== 'string' || organizerUserId.trim() === '') {
      return NextResponse.json({ error: 'Organizer User ID is required' }, { status: 400 });
    }

    let parsedDeadline: Date | null = null;
    if (deadline) {
      parsedDeadline = new Date(deadline);
    }

    const pool = await createPool({
      name: name.trim(),
      description: description?.trim(),
      goalAmount,
      deadline: parsedDeadline,
      organizerAddress,
      organizerUserId,
    });

    return NextResponse.json(pool, { status: 201 });
  } catch (error) {
    console.error('Error creating pool:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
