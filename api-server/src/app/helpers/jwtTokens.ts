import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";

const generateToken = (
	payload: JwtPayload,
	secret: string,
	expiresIn: string
) => {
	const token = jwt.sign(payload, secret, {
		expiresIn,
		algorithm: "HS256"
	} as SignOptions);

	return token;
};

const verifyToken = (token: string, secret: string) => {
	const verifiedToken = jwt.verify(token, secret);
	return verifiedToken;
};

export const JwtTokens = {
	generateToken,
	verifyToken,
};
