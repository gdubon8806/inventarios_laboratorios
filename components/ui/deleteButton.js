import Button from '@mui/material/Button';
import DeleteIcon from '@mui/icons-material/Delete';

export default function deleteButton() {
    return (
        <Button variant="outlined" startIcon={<DeleteIcon />}>
            Eliminar
        </Button>
    );
}