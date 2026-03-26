import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type WaitlistStatus = 'pendente' | 'informado' | 'apto' | 'agendado' | 'operado' | 'concluido' | 'cancelado';

export interface Patient {
  id?: string;
  cedula: string;
  firstname: string;
  lastname: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
}

export interface WaitlistEntry {
  id?: string;
  patient_id: string;
  institution_id: string;
  assigned_institution_id?: string;
  status: WaitlistStatus;
  pre_surgical_data?: any;
  exams_data?: any;
  request_file_url?: string;
  aptitude_file_url?: string;
  journey_id?: string;
  notes?: string;
  patient?: Patient;
  pre_op_va_right?: string;
  pre_op_va_left?: string;
  post_op_va_right?: string;
  post_op_va_left?: string;
  exam_hemograma?: boolean;
  exam_glicemia?: boolean;
  exam_hba1c?: boolean;
  exam_crasis?: boolean;
  exam_orina?: boolean;
  exam_ecg?: boolean;
  has_diabetes?: boolean;
  has_hipertensao?: boolean;
  has_anticoagulados?: boolean;
  pending_reason?: string;
  post_op_data?: any;
  created_at?: string;
  informed_at?: string;
  apto_at?: string;
  scheduled_at?: string;
  operated_at?: string;
  finalized_at?: string;
  surgery_date?: string;
  surgery_time?: string;
  surgeon_id?: string;
  surgeon?: Surgeon;
  requesting_doctor?: string;
  target_eye?: 'OD' | 'OS';
  pre_op_va_od?: string;
  pre_op_va_os?: string;
  post_op_va_od?: string;
  post_op_va_os?: string;
  actual_surgery_date?: string;
}

export interface Surgeon {
  id: string;
  name: string;
  specialty?: string;
  is_active: boolean;
}

export interface Journey {
  id?: string;
  name: string;
  date: string;
  institution_id: string;
  max_capacity: number;
  description?: string;
}

export function useWaitlist() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [surgeons, setSurgeons] = useState<Surgeon[]>([]);

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('conofta_waitlist' as any)
        .select('*, patient:conofta_patients(*), surgeon:conofta_surgeons(*)');

      // Add logic for data isolation if needed, 
      // but for now we fetch all and let the component handle UI filters if needed,
      // or we can strictly filter here if we have the role info.
      
      const { data, error } = await (query.order('created_at', { ascending: false }) as any);

      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      console.error("Error fetching waitlist:", error);
      toast.error("Erro ao carregar lista de espera");
    } finally {
      setLoading(false);
    }
  };

  const fetchJourneys = async () => {
    try {
      const { data, error } = await (supabase
        .from('conofta_journeys' as any)
        .select('*')
        .order('date', { ascending: true }) as any);

      if (error) throw error;
      setJourneys(data || []);
    } catch (error: any) {
      console.error("Error fetching journeys:", error);
    }
  };

  const fetchSurgeons = async () => {
    try {
      const { data, error } = await (supabase
        .from('conofta_surgeons' as any)
        .select('*')
        .eq('is_active', true)
        .order('name') as any);

      if (error) throw error;
      setSurgeons(data || []);
    } catch (error: any) {
      console.error("Error fetching surgeons:", error);
    }
  };

  const addPatientToWaitlist = async (patient: Patient, entry: Omit<WaitlistEntry, 'patient_id'>, files?: { request?: File, aptitude?: File }) => {
    setLoading(true);
    try {
      // 1. Check/Insert Patient
      let patientId = patient.id;
      if (!patientId) {
        const { data: pData, error: pError } = await (supabase
          .from('conofta_patients' as any)
          .upsert({
            cedula: patient.cedula,
            firstname: patient.firstname,
            lastname: patient.lastname,
            address: patient.address,
            city: patient.city,
            phone: patient.phone,
            email: patient.email
          }, { onConflict: 'cedula' })
          .select()
          .single() as any);
        
        if (pError) throw pError;
        patientId = pData.id;
      }

      // 2. Upload Files if any
      let requestUrl = entry.request_file_url;
      let aptitudeUrl = entry.aptitude_file_url;

      if (files?.request) {
        const path = `${entry.institution_id}/${patientId}/request_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('conofta_documents')
          .upload(path, files.request);
        if (uploadError) throw uploadError;
        requestUrl = path;
      }

      if (files?.aptitude) {
        const path = `${entry.institution_id}/${patientId}/aptitude_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('conofta_documents')
          .upload(path, files.aptitude);
        if (uploadError) throw uploadError;
        aptitudeUrl = path;
      }

      // 3. Insert Waitlist Entry
      const { error: wError } = await (supabase
        .from('conofta_waitlist' as any)
        .insert({
          patient_id: patientId,
          institution_id: entry.institution_id,
          status: entry.status || 'pendente',
          pre_surgical_data: entry.pre_surgical_data,
          exams_data: entry.exams_data,
          request_file_url: requestUrl,
          aptitude_file_url: aptitudeUrl,
          notes: entry.notes,
          pre_op_va_right: entry.pre_op_va_right,
          pre_op_va_left: entry.pre_op_va_left,
          exam_hemograma: entry.exam_hemograma,
          exam_glicemia: entry.exam_glicemia,
          exam_hba1c: entry.exam_hba1c,
          exam_crasis: entry.exam_crasis,
          exam_orina: entry.exam_orina,
          exam_ecg: entry.exam_ecg,
          has_diabetes: entry.has_diabetes,
          has_hipertensao: entry.has_hipertensao,
          has_anticoagulados: entry.has_anticoagulados,
          pending_reason: entry.pending_reason,
          surgeon_id: entry.surgeon_id,
          surgery_time: entry.surgery_time,
          requesting_doctor: entry.requesting_doctor,
          target_eye: entry.target_eye,
          pre_op_va_od: entry.pre_op_va_od,
          pre_op_va_os: entry.pre_op_va_os,
          created_by: user?.id
        }) as any);

      if (wError) throw wError;

      toast.success("Paciente adicionado à fila com sucesso!");
      fetchWaitlist();
      return true;
    } catch (error: any) {
      console.error("Error adding to waitlist:", error);
      toast.error("Erro ao adicionar paciente: " + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateEntryStatus = async (id: string, status: WaitlistStatus, additionalData?: any) => {
    try {
      const updateObj: any = { status };
      
      // Auto-set dates based on status
      if (status === 'informado') updateObj.informed_at = new Date().toISOString();
      if (status === 'apto') updateObj.apto_at = new Date().toISOString();
      if (status === 'agendado') updateObj.scheduled_at = new Date().toISOString();
      if (status === 'operado') updateObj.operated_at = new Date().toISOString();
      if (status === 'concluido') updateObj.finalized_at = new Date().toISOString();

      if (additionalData) {
        Object.assign(updateObj, additionalData);
      }

      const { error } = await supabase
        .from('conofta_waitlist' as any)
        .update(updateObj)
        .eq('id', id);

      if (error) throw error;
      toast.success("Status atualizado!");
      fetchWaitlist();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status: " + (error.message || "Erro desconhecido"));
    }
  };

  const bulkUpdateStatus = async (ids: string[], status: WaitlistStatus) => {
    setLoading(true);
    try {
      const updateObj: any = { status };
      if (status === 'informado') updateObj.informed_at = new Date().toISOString();

      const { error } = await supabase
        .from('conofta_waitlist' as any)
        .update(updateObj)
        .in('id', ids);

      if (error) throw error;
      toast.success(`${ids.length} pacientes atualizados!`);
      fetchWaitlist();
    } catch (error: any) {
      console.error("Error in bulk update:", error);
      toast.error("Erro na atualização em massa: " + (error.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('conofta_documents')
      .createSignedUrl(path, 60 * 60); // 1 hour
    
    if (error) return null;
    return data.signedUrl;
  };

  useEffect(() => {
    if (user) {
      fetchWaitlist();
      fetchJourneys();
      fetchSurgeons();
    }
  }, [user]);

  return {
    entries,
    journeys,
    surgeons,
    loading,
    addPatientToWaitlist,
    updateEntryStatus,
    bulkUpdateStatus,
    getSignedUrl,
    refresh: fetchWaitlist
  };
}
